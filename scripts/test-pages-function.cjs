#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const sourcePath = path.join(__dirname, '..', 'functions', 'api', 'contact.js');
let source = fs.readFileSync(sourcePath, 'utf8');
source = source.replace(/^import\s+\{[^}]+\}\s+from\s+["'][^"']+["'];\s*/m, '');
source = source.replace('export async function onRequest(context)', 'async function onRequest(context)');
source += '\nmodule.exports = { onRequest };\n';
const calls = [];
const emailCalls = [];
const fakeDb = {
  prepare(sql) {
    const stmt = {
      sql, values: [],
      bind(...values) { this.values = values; return this; },
      async run() { calls.push({ sql: this.sql, values: this.values }); return { success: true, meta: { changes: 1 } }; },
      async first() { return { total_size: 0 }; },
      async all() { return { results: [] }; }
    };
    return stmt;
  }
};
const testModule = { exports: {} };
const sandbox = {
  module: testModule,
  exports: testModule.exports,
  Response, Request, URL, Headers, TextEncoder, crypto: globalThis.crypto,
  console,
  json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } }); },
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
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  },
  fetch: async (url, options) => {
    emailCalls.push({ url, options });
    return new Response(JSON.stringify({ id: 'mock-resend-id' }), { status: 200, headers: { 'content-type': 'application/json' } });
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
    DB: fakeDb,
    RESEND_API_KEY: 're_mock_only',
    MAIL_FROM: 'EDCKPRCAS Website <website@send.example.edu>',
    MAIL_TO: 'edc@kprcas.ac.in',
    ALLOWED_ORIGINS: origin
  };
  const valid = () => new Request(`${origin}/api/contact`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Website Test', email: 'visitor@example.com', subject: 'Question\nInjected header', message: 'I would like information about the EDC.' })
  });
  let response = await onRequest({ request: valid(), env });
  let body = await response.json();
  assert(response.status === 201 && body.emailSent === true, 'valid enquiry reports successful mocked email delivery');
  assert(calls.some(x => x.sql.includes('INSERT INTO cms_inquiries')), 'enquiry is first persisted to the online inbox');
  assert(calls.some(x => x.sql.includes('UPDATE cms_inquiries')), 'email delivery status is persisted');
  assert(emailCalls.length === 1 && emailCalls[0].url === 'https://api.resend.com/emails', 'valid enquiry calls Resend');
  const mail = JSON.parse(emailCalls[0].options.body);
  assert(mail.to[0] === 'edc@kprcas.ac.in', 'recipient is the EDC mailbox');
  assert(mail.reply_to === 'visitor@example.com', 'visitor email is the Reply-To address');
  assert(!mail.subject.includes('\n'), 'email subject header newlines are removed');

  const badOrigin = new Request(`${origin}/api/contact`, { method: 'POST', headers: { Origin: 'https://malicious.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Test User', email: 'visitor@example.com', message: 'A valid length test enquiry.' }) });
  response = await onRequest({ request: badOrigin, env });
  assert(response.status === 403, 'unapproved origin is blocked');

  response = await onRequest({ request: new Request(`${origin}/api/contact`, { method: 'GET', headers: { Origin: origin } }), env });
  assert(response.status === 405, 'GET is not allowed');

  const trap = new Request(`${origin}/api/contact`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ website: 'bot-filled-field', name: 'Bot', email: 'bot@example.com', message: 'Spam test message that should be discarded.' }) });
  response = await onRequest({ request: trap, env });
  assert(response.status === 201 && emailCalls.length === 1, 'honeypot is discarded without sending email');

  response = await onRequest({ request: valid(), env: { ...env, RESEND_API_KEY: '', MAIL_FROM: '' } });
  body = await response.json();
  assert(response.status === 202 && body.emailSent === false, 'enquiry remains saved when email configuration is absent');
  assert(calls.filter(x => x.sql.includes('INSERT INTO cms_inquiries')).length === 2, 'both real enquiries are stored even when mail is unavailable');

  const noDb = await onRequest({ request: valid(), env: { ...env, DB: null } });
  assert(noDb.status === 503, 'missing D1 database fails with a clear service error');
  console.log(`\n${passed} Pages Function checks passed (D1 and Resend mocked; no live email sent).`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
