#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const sourcePath = path.join(__dirname, '..', 'functions', 'api', 'contact.js');
let source = fs.readFileSync(sourcePath, 'utf8');
source = source.replace(/^import\s+\{[^}]+\}\s+from\s+["'][^"']+["'];\s*/m, '');
source = source.replace('export async function onRequest(context)', 'async function onRequest(context)');
source += '\nmodule.exports = { onRequest };\n';

const calls = [];
const bridgeCalls = [];
const mockContentUrl = 'https://script.googleusercontent.com/macros/echo?mock=1';
class FakeD1 {
  prepare(sql) {
    const statement = {
      sql, values: [],
      bind(...values) { this.values = values; return this; },
      async run() { calls.push({ kind: 'run', sql: this.sql, values: this.values }); return { success: true, meta: { changes: 1 } }; },
      async first() { calls.push({ kind: 'first', sql: this.sql, values: this.values }); return null; },
      async all() { return { results: [] }; }
    };
    return statement;
  }
}
const testModule = { exports: {} };
const sandbox = {
  module: testModule,
  exports: testModule.exports,
  Response, Request, URL, Headers, TextEncoder, crypto: webcrypto,
  console,
  json(data, status = 200, headers = {}) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } }); },
  async readJson(request, maxBytes = 32768) {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new Error('too large');
    return JSON.parse(raw || '{}');
  },
  sameOrigin(request) {
    try { return new URL(request.headers.get('Origin')).origin === new URL(request.url).origin; }
    catch { return false; }
  },
  async sha256Hex(value) {
    const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
    const digest = await webcrypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  },
  fetch: async (url, options) => {
    bridgeCalls.push({ url: String(url), options });
    if (String(url).startsWith('https://script.google.com/macros/')) {
      return new Response(null, { status: 302, headers: { Location: mockContentUrl } });
    }
    return new Response(JSON.stringify({ ok: true, messageId: 'apps-script-mock-id' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
};
vm.runInNewContext(source, sandbox, { filename: sourcePath });
const onRequest = testModule.exports.onRequest;
let passed = 0;
function assert(condition, label) {
  if (!condition) throw new Error(`FAIL ${label}`);
  passed += 1;
  console.log(`PASS ${label}`);
}

(async () => {
  const origin = 'https://edckprcas-website.pages.dev';
  const env = {
    DB: new FakeD1(),
    GOOGLE_APPS_SCRIPT_URL: 'https://script.google.com/macros/s/EXAMPLE_DEPLOYMENT_ID/exec',
    GOOGLE_APPS_SCRIPT_TOKEN: 'mock-only-token-never-use-in-production',
    ALLOWED_ORIGINS: origin
  };
  const valid = () => new Request(`${origin}/api/contact`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.12' },
    body: JSON.stringify({ name: 'Website Test', email: 'visitor@example.com', subject: 'Question\nInjected header', message: 'I would like information about the EDC.' })
  });

  let response = await onRequest({ request: valid(), env });
  let body = await response.json();
  assert(response.status === 201 && body.emailSent === true, 'valid enquiry reports successful mocked Apps Script delivery');
  assert(calls.some(item => item.sql.includes('INSERT INTO cms_inquiries')), 'enquiry is persisted to D1 before email dispatch');
  assert(calls.some(item => item.sql.includes('UPDATE cms_inquiries SET email_sent')), 'Apps Script result is saved to enquiry delivery status');
  assert(bridgeCalls.length === 2 && bridgeCalls[0].url === env.GOOGLE_APPS_SCRIPT_URL && bridgeCalls[1].url === mockContentUrl, 'valid enquiry POSTs to Apps Script then GETs its ContentService result URL');
  const payload = JSON.parse(bridgeCalls[0].options.body);
  assert(payload.token === env.GOOGLE_APPS_SCRIPT_TOKEN, 'bridge token is sent server-to-server');
  assert(payload.email === 'visitor@example.com' && payload.name === 'Website Test', 'visitor details are sent to the mail bridge');
  assert(!Object.prototype.hasOwnProperty.call(payload, 'to'), 'visitor cannot choose or override the recipient');
  assert(bridgeCalls[0].options.method === 'POST' && bridgeCalls[0].options.redirect === 'manual', 'Apps Script POST redirect is handled manually to preserve doPost result');
  assert(bridgeCalls[1].options.method === 'GET' && bridgeCalls[1].options.redirect === 'follow', 'one-time Google ContentService URL is read with GET');

  const badOrigin = new Request(`${origin}/api/contact`, { method: 'POST', headers: { Origin: 'https://malicious.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test User', email: 'visitor@example.com', message: 'A valid length test enquiry.' }) });
  response = await onRequest({ request: badOrigin, env });
  assert(response.status === 403, 'unapproved website origin is blocked');

  response = await onRequest({ request: new Request(`${origin}/api/contact`, { method: 'GET', headers: { Origin: origin } }), env });
  assert(response.status === 405, 'GET is not allowed for contact submissions');

  const trap = new Request(`${origin}/api/contact`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ website: 'bot-filled-field', name: 'Bot', email: 'bot@example.com', message: 'Spam test message that should be discarded.' }) });
  response = await onRequest({ request: trap, env });
  assert(response.status === 201 && bridgeCalls.length === 2, 'honeypot request is discarded without sending email');

  response = await onRequest({ request: valid(), env: { ...env, GOOGLE_APPS_SCRIPT_URL: '', GOOGLE_APPS_SCRIPT_TOKEN: '' } });
  body = await response.json();
  assert(response.status === 202 && body.emailSent === false && body.emailConfigured === false, 'enquiry remains saved when Apps Script is not configured');

  response = await onRequest({ request: valid(), env: { ...env, GOOGLE_APPS_SCRIPT_URL: 'https://example.com/exec' } });
  body = await response.json();
  assert(response.status === 202 && body.emailSent === false, 'non-Google or invalid Apps Script URL is rejected safely');

  const failingFetchSandbox = { ...sandbox, fetch: async () => new Response(JSON.stringify({ ok: false, error: 'MailApp quota exhausted.' }), { status: 200 }) };
  const failingModule = { exports: {} };
  failingFetchSandbox.module = failingModule;
  failingFetchSandbox.exports = failingModule.exports;
  vm.runInNewContext(source, failingFetchSandbox, { filename: sourcePath });
  const failingRequest = valid();
  response = await failingModule.exports.onRequest({ request: failingRequest, env });
  body = await response.json();
  assert(response.status === 202 && body.emailSent === false, 'Apps Script sending failure does not discard the D1 enquiry');

  const healthOnlySandbox = { ...sandbox, fetch: async (url, options) => {
    if (String(url).startsWith('https://script.google.com/macros/')) return new Response(null, { status: 302, headers: { Location: mockContentUrl } });
    return new Response(JSON.stringify({ ok: true, service: 'EDCKPRCAS website enquiry mail bridge', ready: true }), { status: 200 });
  } };
  const healthOnlyModule = { exports: {} };
  healthOnlySandbox.module = healthOnlyModule;
  healthOnlySandbox.exports = healthOnlyModule.exports;
  vm.runInNewContext(source, healthOnlySandbox, { filename: sourcePath });
  response = await healthOnlyModule.exports.onRequest({ request: valid(), env });
  body = await response.json();
  assert(response.status === 202 && body.emailSent === false, 'a doGet health response cannot be mistaken for successful email delivery');

  const invalid = new Request(`${origin}/api/contact`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'A', email: 'not-an-email', message: 'Too short' }) });
  response = await onRequest({ request: invalid, env });
  assert(response.status === 400, 'invalid enquiry details are rejected');

  const noDb = await onRequest({ request: valid(), env: { ...env, DB: null } });
  assert(noDb.status === 503, 'missing D1 database returns a service-unavailable response');

  console.log(`\n${passed} Pages Function checks passed (D1 and Google Apps Script mocked; no live email sent).`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
