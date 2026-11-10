#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { webcrypto } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const libPath = path.join(root, 'functions', '_lib', 'cms.js');
const apiPath = path.join(root, 'functions', 'api', '[[path]].js');
let libSource = fs.readFileSync(libPath, 'utf8')
  .replace(/^export\s+/gm, '')
  .replace(/\nexport\s*\{[^}]+\};?\s*$/m, '\n');
let apiSource = fs.readFileSync(apiPath, 'utf8')
  .replace(/^import\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];\s*/m, '')
  .replace('export async function onRequest(context)', 'async function onRequest(context)');

class MemoryD1 {
  constructor() {
    this.admin = null;
    this.sessions = new Map();
    this.loginAttempts = new Map();
    this.content = null;
    this.inquiries = new Map();
    this.mediaFiles = new Map();
    this.mediaChunks = new Map();
  }
  prepare(sql) {
    const db = this;
    return {
      sql,
      values: [],
      bind(...values) { this.values = values; return this; },
      async first() { return db.first(this.sql, this.values); },
      async all() { return db.all(this.sql, this.values); },
      async run() { return db.run(this.sql, this.values); }
    };
  }
  async batch(statements) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
  async first(sql, v) {
    if (sql.includes('SELECT 1 AS ok')) return { ok: 1 };
    if (sql.includes('SELECT id FROM cms_admin')) return this.admin ? { id: 1 } : null;
    if (sql.includes('SELECT username FROM cms_admin')) return this.admin ? { username: this.admin.username } : null;
    if (sql.includes('SELECT username, password_salt')) return this.admin ? { ...this.admin } : null;
    if (sql.includes('SELECT s.username, s.expires_at')) {
      const row = this.sessions.get(v[0]);
      return row && row.expires_at > v[1] ? { username: row.username, expires_at: row.expires_at } : null;
    }
    if (sql.includes('SELECT attempts, locked_until')) return this.loginAttempts.get(v[0]) || null;
    if (sql.includes('SELECT content_json, updated_at')) return this.content ? { ...this.content } : null;
    if (sql.includes('SELECT COALESCE(SUM(file_size)')) {
      const total_size = [...this.mediaFiles.values()].reduce((sum, f) => sum + f.file_size, 0);
      return { total_size };
    }
    return null;
  }
  async all(sql, v) {
    if (sql.includes('FROM cms_inquiries ORDER BY')) {
      return { results: [...this.inquiries.values()].sort((a,b) => b.received_at.localeCompare(a.received_at)).slice(0,1000).map(item => ({ id: item.id, name: item.name, email: item.email, subject: item.subject, message: item.message, receivedAt: item.received_at, status: item.status, emailSent: item.email_sent, emailError: item.email_error })) };
    }
    if (sql.includes('FROM cms_media_files f INNER JOIN cms_media_chunks')) {
      const file = this.mediaFiles.get(v[0]);
      if (!file) return { results: [] };
      const chunks = [...(this.mediaChunks.get(v[0]) || new Map()).entries()].sort((a,b)=>a[0]-b[0]);
      return { results: chunks.map(([chunk_index, data]) => ({ mime_type: file.mime_type, file_size: file.file_size, chunk_index, data })) };
    }
    return { results: [] };
  }
  async run(sql, v) {
    if (sql.includes('INSERT INTO cms_admin')) {
      this.admin = { username: v[1], password_salt: v[2], password_hash: v[3], password_iterations: v[4] };
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.includes('INSERT INTO cms_sessions')) {
      this.sessions.set(v[0], { username: v[1], created_at: v[2], expires_at: v[3] });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.includes('UPDATE cms_sessions SET expires_at')) {
      const row = this.sessions.get(v[1]); if (row) row.expires_at = v[0];
      return { success: true, meta: { changes: row ? 1 : 0 } };
    }
    if (sql.includes('DELETE FROM cms_sessions WHERE token_hash = ? OR expires_at <= ?')) {
      const row = this.sessions.get(v[0]); if (row) this.sessions.delete(v[0]);
      for (const [key, item] of this.sessions) if (item.expires_at <= v[1]) this.sessions.delete(key);
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.includes('DELETE FROM cms_sessions WHERE token_hash <> ?')) {
      for (const key of this.sessions.keys()) if (key !== v[0]) this.sessions.delete(key);
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.includes('DELETE FROM cms_sessions WHERE token_hash = ?')) {
      this.sessions.delete(v[0]); return { success: true, meta: { changes: 1 } };
    }
    if (sql.includes('INSERT INTO cms_login_attempts')) {
      this.loginAttempts.set(v[0], { attempts: v[1], locked_until: v[2], updated_at: v[3] });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.includes('DELETE FROM cms_login_attempts')) {
      this.loginAttempts.delete(v[0]); return { success: true, meta: { changes: 1 } };
    }
    if (sql.includes('INSERT INTO cms_content')) {
      this.content = { content_json: v[0], updated_at: v[1] };
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.includes('INSERT INTO cms_inquiries')) {
      this.inquiries.set(v[0], { id: v[0], name: v[1], email: v[2], subject: v[3], message: v[4], received_at: v[5], status: 'New', email_sent: 0, email_error: null, email_id: null });
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.includes('UPDATE cms_inquiries SET status')) {
      const row = this.inquiries.get(v[1]); if (row) row.status = v[0];
      return { success: true, meta: { changes: row ? 1 : 0 } };
    }
    if (sql.includes('INSERT INTO cms_media_files')) {
      this.mediaFiles.set(v[0], { mime_type: v[1], file_size: v[2], chunk_count: v[3], created_at: v[4] });
      if (!this.mediaChunks.has(v[0])) this.mediaChunks.set(v[0], new Map());
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.includes('INSERT INTO cms_media_chunks')) {
      if (!this.mediaChunks.has(v[0])) this.mediaChunks.set(v[0], new Map());
      this.mediaChunks.get(v[0]).set(v[1], new Uint8Array(v[2]));
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.includes('UPDATE cms_inquiries SET email_sent')) {
      const row = this.inquiries.get(v[3]);
      if (row) { row.email_sent = v[0]; row.email_error = v[1]; row.email_id = v[2]; }
      return { success: true, meta: { changes: row ? 1 : 0 } };
    }
    return { success: true, meta: { changes: 1 } };
  }
}

const fakeDb = new MemoryD1();
const sandbox = {
  module: { exports: {} }, exports: {},
  crypto: webcrypto, TextEncoder, TextDecoder, URL, Request, Response, Headers,
  Uint8Array, ArrayBuffer, Date, Math, JSON, String, Number, Object, Map, Set, RegExp,
  console,
  fetch: async () => new Response(JSON.stringify({ id: 'mock-email-id' }), { status: 200, headers: { 'content-type': 'application/json' } })
};
const allSource = `${libSource}\n${apiSource}\nmodule.exports = { onRequest };`;
vm.runInNewContext(allSource, sandbox, { filename: `${libPath} + ${apiPath}` });
const onRequest = sandbox.module.exports.onRequest;
let passed = 0;
function assert(condition, label) {
  if (!condition) throw new Error(`FAIL ${label}`);
  passed += 1;
  console.log(`PASS ${label}`);
}
function req(origin, path, method='GET', body=null, cookie='') {
  const headers = new Headers();
  if (method !== 'GET') headers.set('Origin', origin);
  if (body !== null) headers.set('Content-Type', 'application/json');
  if (cookie) headers.set('Cookie', cookie);
  return new Request(`${origin}${path}`, { method, headers, body: body === null ? undefined : JSON.stringify(body) });
}
(async () => {
  const origin = 'https://edckprcas-website.pages.dev';
  const env = { DB: fakeDb, CMS_SETUP_TOKEN: 'first-time-token-0000000000000000', CMS_PASSWORD_PEPPER: 'pepper'.repeat(8) };
  let response = await onRequest({ request: req(origin, '/api/health'), env });
  let body = await response.json();
  assert(response.status === 200 && body.ok === true && body.storage === 'Cloudflare D1', 'health endpoint sees D1 binding');

  response = await onRequest({ request: req(origin, '/api/auth/status'), env });
  body = await response.json();
  assert(response.status === 200 && body.setupRequired === true && body.authenticated === false, 'first-run auth status requests setup');

  response = await onRequest({ request: req(origin, '/api/content'), env });
  assert(response.status === 503, 'public content reports missing initial D1 seed');

  response = await onRequest({ request: req(origin, '/api/admin/setup', 'POST', { username: 'edcadmin', password: 'A-strong-unique-passphrase-123', setupToken: 'wrong' }), env });
  assert(response.status === 403, 'first-admin setup rejects an incorrect setup key');

  response = await onRequest({ request: req(origin, '/api/admin/setup', 'POST', { username: 'edcadmin', password: 'A-strong-unique-passphrase-123', setupToken: env.CMS_SETUP_TOKEN }), env });
  assert(response.status === 201, 'first online administrator can be created');
  const cookieHeader = response.headers.get('set-cookie') || '';
  const cookie = (cookieHeader.match(/kpr_sid=[^;]+/) || [])[0] || '';
  assert(Boolean(cookie) && /HttpOnly/.test(cookieHeader) && /Secure/.test(cookieHeader), 'CMS session cookie is HttpOnly and Secure');

  response = await onRequest({ request: req(origin, '/api/admin/data'), env });
  assert(response.status === 401, 'CMS data is not accessible without an authenticated session');

  const starter = { site: { name: 'EDCKPRCAS', website: '' }, home: { title: 'Think Entrepreneur!' }, people: [], events: [], startups: [] };
  fakeDb.content = { content_json: JSON.stringify(starter), updated_at: new Date().toISOString() };
  response = await onRequest({ request: req(origin, '/api/content'), env });
  body = await response.json();
  assert(response.status === 200 && body.site.website === origin, 'public API returns seeded content with active site origin');

  response = await onRequest({ request: req(origin, '/api/admin/data', 'GET', null, cookie), env });
  body = await response.json();
  assert(response.status === 200 && body.site.name === 'EDCKPRCAS', 'authenticated Content Manager can read online content');

  const updated = { ...starter, home: { title: 'Updated by Online CMS' } };
  response = await onRequest({ request: req(origin, '/api/admin/data', 'PUT', updated, cookie), env });
  body = await response.json();
  assert(response.status === 200 && body.ok === true, 'authenticated Content Manager can save content to D1');
  assert(JSON.parse(fakeDb.content.content_json).site.website === origin, 'CMS save stores the active custom-domain origin');

  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
  response = await onRequest({ request: new Request(`${origin}/api/admin/upload?filename=sample.png`, { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'image/png' }, body: bytes }), env });
  body = await response.json();
  assert(response.status === 201 && body.url.startsWith('/api/media/'), 'authenticated CMS can upload an image to D1');

  response = await onRequest({ request: req(origin, body.url), env });
  const received = new Uint8Array(await response.arrayBuffer());
  assert(response.status === 200 && received.length === bytes.length && received.every((v,i)=>v===bytes[i]), 'uploaded media can be retrieved intact');

  const inquiryId = '9f8b01ad-9ad0-4fe1-96a6-5a7c0b121234';
  fakeDb.inquiries.set(inquiryId, { id: inquiryId, name: 'Website Visitor', email: 'visitor@example.com', subject: 'Question', message: 'Please contact me about the EDC.', received_at: new Date().toISOString(), status: 'New', email_sent: 1, email_error: null, email_id: 'mock' });
  response = await onRequest({ request: req(origin, '/api/admin/inquiries', 'GET', null, cookie), env });
  body = await response.json();
  assert(response.status === 200 && body.length === 1 && body[0].emailSent === true, 'online Enquiry Inbox returns stored enquiries and email status');

  response = await onRequest({ request: req(origin, `/api/admin/inquiries/${inquiryId}`, 'PATCH', { status: 'Resolved' }, cookie), env });
  assert(response.status === 200 && fakeDb.inquiries.get(inquiryId).status === 'Resolved', 'administrator can update enquiry status');

  response = await onRequest({ request: req(origin, '/api/admin/logout', 'POST', {}, cookie), env });
  assert(response.status === 200, 'administrator can sign out');
  response = await onRequest({ request: req(origin, '/api/admin/data', 'GET', null, cookie), env });
  assert(response.status === 401, 'signed-out session cannot access CMS data');

  console.log(`\n${passed} Online CMS Pages Function checks passed (in-memory D1 mock; no live Cloudflare account or email used).`);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
