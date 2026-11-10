'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const tls = require('node:tls');
const dns = require('node:dns').promises;
const net = require('node:net');

function loadEnvFile() {
  const envFile = path.join(__dirname, '.env');
  if (!fs.existsSync(envFile)) return;
  for (const rawLine of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('='); if (at < 1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile();

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const DATA_FILE = path.join(DATA_DIR, 'site-data.json');
const AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');
const INQUIRIES_FILE = path.join(DATA_DIR, 'inquiries.json');
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(PUBLIC, 'uploads'));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const sessions = new Map();
const loginAttempts = new Map();

for (const dir of [DATA_DIR, UPLOAD_DIR]) fs.mkdirSync(dir, { recursive: true });
// When a persistent disk is mounted on a new host, seed the first-run CMS data and official logo once.
// Existing disk data is never overwritten during redeploys.
if (!fs.existsSync(DATA_FILE)) {
  const seedData = path.join(ROOT, 'data', 'site-data.json');
  if (fs.existsSync(seedData)) fs.copyFileSync(seedData, DATA_FILE);
}
if (!fs.existsSync(INQUIRIES_FILE)) fs.writeFileSync(INQUIRIES_FILE, '[]');
const bundledUploads = path.join(PUBLIC, 'uploads');
if (fs.existsSync(bundledUploads) && path.resolve(bundledUploads) !== UPLOAD_DIR) {
  for (const entry of fs.readdirSync(bundledUploads, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name.startsWith('.')) continue;
    const source = path.join(bundledUploads, entry.name);
    const destination = path.join(UPLOAD_DIR, entry.name);
    if (!fs.existsSync(destination)) fs.copyFileSync(source, destination);
  }
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}
function send(res, status, payload, headers = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
function readBody(req, limit = 16 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', chunk => { size += chunk.length; if (size > limit) { reject(new Error('Request is too large.')); req.destroy(); } else chunks.push(chunk); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJsonBody(req, limit) {
  const raw = await readBody(req, limit || 2 * 1024 * 1024);
  try { return JSON.parse(raw.toString('utf8') || '{}'); } catch { throw new Error('Please provide valid JSON.'); }
}
function cookieValue(req, name) {
  const header = req.headers.cookie || '';
  const item = header.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
}
function isAuthed(req) {
  const sid = cookieValue(req, 'kpr_sid');
  const expiry = sessions.get(sid);
  if (!sid || !expiry || expiry < Date.now()) { sessions.delete(sid); return false; }
  sessions.set(sid, Date.now() + 8 * 60 * 60 * 1000);
  return true;
}
function requireAuth(req, res) {
  if (!isAuthed(req)) { send(res, 401, { error: 'Please sign in to the Content Manager.' }); return false; }
  return true;
}
function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function passwordMatches(password, record) {
  const candidate = crypto.scryptSync(password, record.salt, 64);
  const expected = Buffer.from(record.hash, 'hex');
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}
function authRecord() { return readJson(AUTH_FILE, null); }
function mimeType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({ '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.pdf':'application/pdf', '.ico':'image/x-icon', '.txt':'text/plain; charset=utf-8' })[ext] || 'application/octet-stream';
}
function safeFilename(value) {
  const ext = path.extname(value).toLowerCase();
  const base = path.basename(value, ext).normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'upload';
  return `${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${base}${ext}`;
}
const SOCIAL_HOSTS = ['youtube.com','youtu.be','youtube-nocookie.com','instagram.com','linkedin.com','lnkd.in','facebook.com','fb.watch','tiktok.com','x.com','twitter.com'];
function hostMatches(host, domain) { return host === domain || host.endsWith(`.${domain}`); }
function isPublicIp(address) {
  const version = net.isIP(address);
  if (version === 4) {
    const p = address.split('.').map(Number);
    return !(p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127));
  }
  if (version === 6) {
    const a = address.toLowerCase();
    return !(a === '::' || a === '::1' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80:') || a.startsWith('::ffff:127.') || a.startsWith('::ffff:10.') || a.startsWith('::ffff:192.168.'));
  }
  return false;
}
async function validateRemoteUrl(value, socialOnly = false) {
  let target;
  try { target = new URL(String(value || '')); } catch { throw new Error('Enter a valid public social media URL.'); }
  if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Only public HTTPS links are supported for social previews.');
  if (socialOnly && !SOCIAL_HOSTS.some(domain => hostMatches(target.hostname.toLowerCase(), domain))) throw new Error('Use a public YouTube, Instagram, LinkedIn, Facebook, TikTok or X post URL.');
  if (net.isIP(target.hostname)) throw new Error('IP-address URLs are not accepted.');
  let addresses;
  try { addresses = await dns.lookup(target.hostname, { all:true, verbatim:true }); }
  catch { throw new Error('The social platform could not be reached.'); }
  if (!addresses.length || addresses.some(item => !isPublicIp(item.address))) throw new Error('The link does not resolve to a public internet address.');
  return target;
}
async function fetchBounded(url, { maxBytes=1024*1024, accept='text/html', socialOnly=false } = {}) {
  let target = url;
  for (let redirects=0; redirects<=3; redirects++) {
    await validateRemoteUrl(target, socialOnly && redirects===0);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 11000);
    let response;
    try {
      response = await fetch(target, { method:'GET', redirect:'manual', signal:controller.signal, headers:{ 'User-Agent':'Mozilla/5.0 (compatible; EDCKPRCAS-SitePreview/1.0)', 'Accept':accept } });
    } catch (error) {
      clearTimeout(timeout);
      throw new Error(error.name==='AbortError' ? 'The platform preview timed out.' : 'The platform could not be reached from the server.');
    }
    if ([301,302,303,307,308].includes(response.status)) {
      clearTimeout(timeout);
      const location = response.headers.get('location');
      if (!location || redirects===3) throw new Error('The social platform redirected too many times.');
      target = new URL(location,target).toString();
      continue;
    }
    if (!response.ok) { clearTimeout(timeout); throw new Error(`The platform did not provide a public preview (HTTP ${response.status}).`); }
    const type = (response.headers.get('content-type')||'').toLowerCase();
    if (accept.includes('text/html') && !type.includes('text/html') && !type.includes('application/xhtml')) { clearTimeout(timeout); throw new Error('The link did not return a public web page.'); }
    const reader = response.body?.getReader();
    if (!reader) { clearTimeout(timeout); throw new Error('The platform returned an empty response.'); }
    const chunks=[]; let size=0;
    try {
      while (true) {
        const {done,value}=await reader.read(); if(done) break;
        size += value.byteLength;
        if (size>maxBytes) { await reader.cancel(); throw new Error('The social preview is larger than the allowed size.'); }
        chunks.push(Buffer.from(value));
      }
    } finally { clearTimeout(timeout); }
    return { buffer:Buffer.concat(chunks), contentType:type, url:target };
  }
  throw new Error('Could not resolve the social media preview.');
}
function decodeHtml(value) { return String(value||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>'); }
function metaValue(html, wanted) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const attr = name => (tag.match(new RegExp(`\\b${name}\\s*=\\s*([\"'])(.*?)\\1`, 'i')) || [])[2] || '';
    const key = (attr('property') || attr('name') || '').toLowerCase();
    if (key === wanted.toLowerCase()) return decodeHtml(attr('content'));
  }
  return '';
}
function extractYouTubeId(value) {
  try {
    const u=new URL(value); let id='';
    if (u.hostname.includes('youtu.be')) id=u.pathname.split('/').filter(Boolean)[0]||'';
    else if (u.hostname.includes('youtube.com')) id=u.searchParams.get('v') || (u.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)||[])[1] || '';
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  } catch { return ''; }
}
async function saveSocialThumbnail(url) {
  const socialUrl = await validateRemoteUrl(url,true);
  let imageUrl='', title='';
  const youtubeId=extractYouTubeId(socialUrl.toString());
  if (youtubeId) {
    title='YouTube video';
    for (const quality of ['maxresdefault','hqdefault','mqdefault']) {
      try {
        const result=await fetchBounded(`https://i.ytimg.com/vi/${youtubeId}/${quality}.jpg`,{maxBytes:5*1024*1024,accept:'image/*'});
        if (result.contentType.startsWith('image/')) { imageUrl=result.url; break; }
      } catch { /* Try the next official YouTube thumbnail size. */ }
    }
  } else {
    const page=await fetchBounded(socialUrl.toString(),{maxBytes:1024*1024,accept:'text/html,application/xhtml+xml',socialOnly:true});
    const html=page.buffer.toString('utf8');
    imageUrl=metaValue(html,'og:image') || metaValue(html,'twitter:image') || metaValue(html,'twitter:image:src');
    title=metaValue(html,'og:title') || metaValue(html,'twitter:title') || '';
    if (imageUrl) imageUrl = new URL(imageUrl,socialUrl).toString();
  }
  if (!imageUrl) throw new Error('This platform does not expose a public thumbnail to the website. Upload a post image manually instead.');
  const image=await fetchBounded(imageUrl,{maxBytes:5*1024*1024,accept:'image/*'});
  const allowedMime={ 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif' };
  const mime=image.contentType.split(';')[0];
  if (!allowedMime[mime]) throw new Error('The platform thumbnail is not a supported image format.');
  const filename=safeFilename(`social-preview${allowedMime[mime]}`);
  fs.writeFileSync(path.join(UPLOAD_DIR,filename),image.buffer,{flag:'wx'});
  return { url:`/uploads/${filename}`,filename,title };
}
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()); }

function createSmtpReader(socket) {
  let rest = ''; let lines = []; const waiting = []; const queued = []; let failure = null;
  socket.on('data', chunk => {
    rest += chunk.toString('utf8');
    let cut;
    while ((cut = rest.indexOf('\n')) >= 0) {
      const line = rest.slice(0, cut).replace(/\r$/, ''); rest = rest.slice(cut + 1); lines.push(line);
      if (/^\d{3} /.test(line)) {
        const response = lines.join('\n'); lines = [];
        const waiter = waiting.shift(); if (waiter) waiter.resolve(response); else queued.push(response);
      }
    }
  });
  socket.on('error', error => { failure = error; while (waiting.length) waiting.shift().reject(error); });
  return () => new Promise((resolve, reject) => {
    if (failure) return reject(failure);
    if (queued.length) return resolve(queued.shift());
    waiting.push({ resolve, reject });
  });
}
async function sendEdcEnquiryEmail({ name, email, subject, message }) {
  // Resend is the production provider for Cloudflare Pages and the preferred
  // local test provider. Keep SMTP as a compatibility fallback for local use.
  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  if (resendKey) {
    const from = String(process.env.MAIL_FROM || '').trim();
    const to = String(process.env.MAIL_TO || 'edc@kprcas.ac.in').trim();
    if (!from || !to) throw new Error('Set MAIL_FROM and MAIL_TO before sending email.');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [to], reply_to: email,
        subject: subject || 'EDCKPRCAS website enquiry',
        text: `A new enquiry was submitted through the EDCKPRCAS website.\n\nName: ${name}\nEmail: ${email}\nSubject: ${subject || 'General enquiry'}\n\nMessage:\n${message}`
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Resend rejected the email (${response.status}): ${String(result.message || result.name || 'Check the Resend API key and verified sender domain.').slice(0, 220)}`);
    return { sent: true, configured: true, provider: 'Resend', id: result.id || '' };
  }

  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '');
  if (!host || !user || !pass) return { sent: false, configured: false };
  const port = Number(process.env.SMTP_PORT || 465);
  if (port !== 465) throw new Error('SMTP mail delivery is configured for implicit TLS on port 465. Set SMTP_PORT=465 or configure a compatible TLS relay.');
  const from = String(process.env.SMTP_FROM || user).trim();
  const to = 'edc@kprcas.ac.in';
  const socket = tls.connect({ host, port, servername: host, timeout: 20000 });
  socket.setTimeout(20000, () => socket.destroy(new Error('SMTP connection timed out.')));
  const nextReply = createSmtpReader(socket);
  const expect = async (codes) => {
    const response = await nextReply();
    const code = Number(response.slice(0, 3));
    if (!codes.includes(code)) throw new Error(`SMTP rejected a mail command (${code}): ${response.split('\n').slice(-1)[0]}`);
    return response;
  };
  const command = async (value, codes) => { socket.write(value + '\r\n'); return expect(codes); };
  try {
    await new Promise((resolve, reject) => {
      socket.once('secureConnect', resolve);
      socket.once('error', reject);
      socket.setTimeout(20000, () => reject(new Error('SMTP connection timed out.')));
    });
    await expect([220]);
    await command(`EHLO ${String(process.env.SMTP_HELO || 'edckprcas.local').replace(/[^a-zA-Z0-9.-]/g,'')}`, [250]);
    await command('AUTH LOGIN', [334]);
    await command(Buffer.from(user).toString('base64'), [334]);
    await command(Buffer.from(pass).toString('base64'), [235]);
    await command(`MAIL FROM:<${from}>`, [250]);
    await command(`RCPT TO:<${to}>`, [250, 251]);
    await command('DATA', [354]);
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject || 'EDCKPRCAS website enquiry').toString('base64')}?=`;
    const body = [
      'A new enquiry was submitted through the EDCKPRCAS website.',
      '',
      `Name: ${name}`,
      `Email: ${email}`,
      `Subject: ${subject || 'General enquiry'}`,
      '',
      'Message:',
      message,
      '',
      'This message is also stored in the Content Manager enquiry inbox.'
    ].join('\r\n').replace(/(^|\r\n)\./g, '$1..');
    const headers = [
      `From: EDCKPRCAS Website <${from}>`,
      `To: ${to}`,
      `Reply-To: ${email}`,
      `Subject: ${encodedSubject}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 8bit`
    ].join('\r\n');
    socket.write(headers + '\r\n\r\n' + body + '\r\n.\r\n');
    await expect([250]);
    socket.write('QUIT\r\n');
    await expect([221]).catch(() => {});
    return { sent: true, configured: true };
  } finally {
    socket.end();
  }
}

const server = http.createServer(async (req, res) => {
  const origin = `http://${req.headers.host || `localhost:${PORT}`}`;
  let url;
  try { url = new URL(req.url, origin); } catch { return send(res, 400, { error: 'Invalid request URL.' }); }
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true, name: 'EDCKPRCAS Content Manager', node: process.version });
    if (pathname === '/robots.txt' && req.method === 'GET') {
      const base=String(process.env.SITE_URL || readJson(DATA_FILE,{}).site?.website || `${req.headers['x-forwarded-proto']||'https'}://${req.headers.host||'localhost'}`).replace(/\/$/,'');
      return send(res,200,`User-agent: *\nAllow: /\nDisallow: /content-manager/\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`,{'Content-Type':'text/plain; charset=utf-8'});
    }
    if (pathname === '/sitemap.xml' && req.method === 'GET') {
      const siteData=readJson(DATA_FILE,{}); const base=String(process.env.SITE_URL || siteData.site?.website || `${req.headers['x-forwarded-proto']||'https'}://${req.headers.host||'localhost'}`).replace(/\/$/,'');
      const xml = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&apos;');
      const pages=['','about.html','people.html','events.html','startups.html','impact.html','messages.html','gallery.html','blogs.html','social-media.html','mentors.html','annual-reports.html','contact.html','opportunities.html','achievements.html'];
      const urls=pages.map(page=>`<url><loc>${xml(base+'/'+page)}</loc></url>`);
      (siteData.teams||[]).filter(team=>team.yearKey).forEach(team=>urls.push(`<url><loc>${xml(`${base}/team.html?year=${encodeURIComponent(team.yearKey)}`)}</loc></url>`));
      (siteData.blogs||[]).filter(item=>{const status=String(item.status||'Published').toLowerCase();const time=item.publishAt?new Date(item.publishAt).getTime():0;return !['draft','unpublished','hidden'].includes(status)&&!(time>Date.now())&&(status!=='scheduled'||time>0);}).forEach(item=>urls.push(`<url><loc>${xml(`${base}/blog.html?id=${encodeURIComponent(item.id)}`)}</loc></url>`));
      return send(res,200,`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`,{'Content-Type':'application/xml; charset=utf-8'});
    }
    if (pathname === '/api/content' && req.method === 'GET') return send(res, 200, readJson(DATA_FILE, {}));
    if (pathname === '/api/auth/status' && req.method === 'GET') return send(res, 200, { setupRequired: !authRecord(), authenticated: isAuthed(req) });

    if (pathname === '/api/admin/setup' && req.method === 'POST') {
      if (authRecord()) return send(res, 409, { error: 'A Content Manager account already exists. Please sign in.' });
      const body = await readJsonBody(req, 16 * 1024);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) return send(res, 400, { error: 'Username must be 3–32 characters and use letters, numbers, dots, dashes or underscores.' });
      if (password.length < 10) return send(res, 400, { error: 'Use a password with at least 10 characters.' });
      const secured = passwordHash(password);
      writeJson(AUTH_FILE, { username, ...secured, createdAt: new Date().toISOString() });
      const sid = crypto.randomBytes(32).toString('hex');
      sessions.set(sid, Date.now() + 8 * 60 * 60 * 1000);
      return send(res, 201, { ok: true, username }, { 'Set-Cookie': `kpr_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` });
    }

    if (pathname === '/api/admin/login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress || 'local';
      const attempt = loginAttempts.get(ip) || { count: 0, until: 0 };
      if (attempt.until > Date.now()) return send(res, 429, { error: 'Too many attempts. Please wait a few minutes and try again.' });
      const body = await readJsonBody(req, 16 * 1024);
      const record = authRecord();
      if (!record) return send(res, 409, { error: 'Create the first Content Manager account before signing in.' });
      if (String(body.username || '') !== record.username || !passwordMatches(String(body.password || ''), record)) {
        attempt.count += 1; if (attempt.count >= 8) { attempt.count = 0; attempt.until = Date.now() + 5 * 60 * 1000; }
        loginAttempts.set(ip, attempt);
        return send(res, 401, { error: 'The username or password is incorrect.' });
      }
      loginAttempts.delete(ip);
      const sid = crypto.randomBytes(32).toString('hex');
      sessions.set(sid, Date.now() + 8 * 60 * 60 * 1000);
      return send(res, 200, { ok: true, username: record.username }, { 'Set-Cookie': `kpr_sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` });
    }

    if (pathname === '/api/admin/logout' && req.method === 'POST') {
      const sid = cookieValue(req, 'kpr_sid'); sessions.delete(sid);
      return send(res, 200, { ok: true }, { 'Set-Cookie': 'kpr_sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
    }

    if (pathname === '/api/admin/whoami' && req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      const record = authRecord();
      return send(res, 200, { username: record?.username || 'admin' });
    }
    if (pathname === '/api/admin/data' && req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      return send(res, 200, readJson(DATA_FILE, {}));
    }
    if (pathname === '/api/admin/data' && req.method === 'PUT') {
      if (!requireAuth(req, res)) return;
      const data = await readJsonBody(req, 8 * 1024 * 1024);
      if (!data || typeof data !== 'object' || Array.isArray(data) || !data.site || typeof data.site !== 'object') return send(res, 400, { error: 'The content structure is not valid.' });
      writeJson(DATA_FILE, data);
      return send(res, 200, { ok: true, savedAt: new Date().toISOString() });
    }
    if (pathname === '/api/admin/password' && req.method === 'POST') {
      if (!requireAuth(req, res)) return;
      const body = await readJsonBody(req, 16 * 1024);
      const record = authRecord();
      if (!record || !passwordMatches(String(body.currentPassword || ''), record)) return send(res, 401, { error: 'Current password is not correct.' });
      if (String(body.newPassword || '').length < 10) return send(res, 400, { error: 'New password must be at least 10 characters.' });
      const secured = passwordHash(String(body.newPassword));
      writeJson(AUTH_FILE, { username: record.username, ...secured, createdAt: record.createdAt, updatedAt: new Date().toISOString() });
      return send(res, 200, { ok: true });
    }
    if (pathname === '/api/admin/upload' && req.method === 'POST') {
      if (!requireAuth(req, res)) return;
      const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
      const extByType = { 'image/jpeg':'.jpg', 'image/png':'.png', 'image/webp':'.webp', 'image/gif':'.gif', 'application/pdf':'.pdf' };
      if (!extByType[contentType]) return send(res, 415, { error: 'Upload a JPG, PNG, WEBP, GIF or PDF file.' });
      const raw = await readBody(req, 12 * 1024 * 1024);
      if (!raw.length) return send(res, 400, { error: 'The selected file is empty.' });
      const original = url.searchParams.get('filename') || `upload${extByType[contentType]}`;
      const ext = extByType[contentType];
      const filename = safeFilename(path.basename(original, path.extname(original)) + ext);
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), raw);
      return send(res, 201, { ok: true, url: `/uploads/${filename}`, filename });
    }
    if (pathname === '/api/admin/social-preview' && req.method === 'POST') {
      if (!requireAuth(req,res)) return;
      const body=await readJsonBody(req,16*1024);
      const value=String(body.url||'').trim();
      if (!value) return send(res,400,{error:'Paste a public social media post or video URL first.'});
      try { const preview=await saveSocialThumbnail(value); return send(res,201,{ok:true,...preview}); }
      catch(error) { return send(res,422,{error:String(error.message||'Could not fetch a public thumbnail.').slice(0,260)}); }
    }
    if (pathname === '/api/contact' && req.method === 'POST') {
      const body = await readJsonBody(req, 32 * 1024);
      if (String(body.website || '').trim()) return send(res, 201, { ok: true, message: 'Thank you. Your enquiry has been received.' });
      const name = String(body.name || '').trim().slice(0, 100);
      const email = String(body.email || '').trim().slice(0, 160);
      const subject = String(body.subject || '').trim().slice(0, 160);
      const message = String(body.message || '').trim().slice(0, 5000);
      if (name.length < 2 || !validEmail(email) || message.length < 10) return send(res, 400, { error: 'Please provide your name, a valid email address and a message of at least 10 characters.' });
      const inbox = readJson(INQUIRIES_FILE, []);
      const enquiry = { id: crypto.randomUUID(), name, email, subject, message, receivedAt: new Date().toISOString(), status: 'New', emailSent: false };
      inbox.unshift(enquiry);
      writeJson(INQUIRIES_FILE, inbox.slice(0, 1000));
      let delivery = { sent: false, configured: false };
      try { delivery = await sendEdcEnquiryEmail({ name, email, subject: subject || 'EDCKPRCAS website enquiry', message }); }
      catch (error) { delivery.configured = Boolean(process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)); enquiry.emailError = String(error.message || 'Email delivery failed.').slice(0, 300); }
      enquiry.emailSent = Boolean(delivery.sent);
      writeJson(INQUIRIES_FILE, inbox.slice(0, 1000));
      const messageText = delivery.sent
        ? 'Thank you. Your enquiry has been emailed to edc@kprcas.ac.in and saved in the Content Manager inbox.'
        : delivery.configured
          ? 'Your enquiry has been saved in the Content Manager inbox, but the email service did not accept it. The Content Manager inbox records the delivery error.'
          : 'Your enquiry has been saved in the local Content Manager inbox. Email delivery to edc@kprcas.ac.in needs Resend or SMTP settings in the private .env file.';
      return send(res, 201, { ok: true, emailSent: Boolean(delivery.sent), emailConfigured: Boolean(delivery.configured), message: messageText });
    }
    if (pathname === '/api/admin/inquiries' && req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      return send(res, 200, readJson(INQUIRIES_FILE, []));
    }
    const inquiryMatch = pathname.match(/^\/api\/admin\/inquiries\/([a-f0-9-]+)$/i);
    if (inquiryMatch && req.method === 'PATCH') {
      if (!requireAuth(req, res)) return;
      const body = await readJsonBody(req, 8 * 1024);
      const inbox = readJson(INQUIRIES_FILE, []);
      const item = inbox.find(x => x.id === inquiryMatch[1]);
      if (!item) return send(res, 404, { error: 'Enquiry not found.' });
      if (body.status) item.status = String(body.status).slice(0, 30);
      writeJson(INQUIRIES_FILE, inbox);
      return send(res, 200, { ok: true });
    }

    // Serve the public website and the admin application.
    let relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    if (relative === 'content-manager' || relative === 'content-manager/') relative = 'content-manager/index.html';
    if (relative === 'admin' || relative === 'admin/') relative = 'content-manager/index.html';
    const target = relative.startsWith('uploads/')
      ? path.resolve(UPLOAD_DIR, relative.slice('uploads/'.length))
      : path.resolve(PUBLIC, relative);
    if (relative.startsWith('uploads/')) {
      if (!target.startsWith(UPLOAD_DIR + path.sep)) return send(res,403,'Forbidden');
    } else if (!target.startsWith(PUBLIC + path.sep) && target !== path.join(PUBLIC, 'index.html')) return send(res, 403, 'Forbidden');
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return send(res, 404, 'Page not found');
    const content = fs.readFileSync(target);
    const isFaviconAsset = /(?:favicon|apple-touch-icon)/i.test(path.basename(target));
    const cacheControl = isFaviconAsset
      ? 'no-store, max-age=0, must-revalidate'
      : /\.(html|css|js)$/.test(target)
        ? 'no-cache'
        : 'public, max-age=3600';
    res.writeHead(200, { 'Content-Type': mimeType(target), 'Cache-Control': cacheControl, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
    return res.end(content);
  } catch (error) {
    if (!res.headersSent) send(res, 500, { error: error.message || 'Unexpected server error.' });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log('\n  KPRCAS EDC CORPORATE WEBSITE');
  console.log('  -----------------------------------------');
  console.log(`  Website : http://${HOST}:${PORT}/`);
  console.log(`  Content Manager : http://${HOST}:${PORT}/content-manager/`);
  console.log(`  Status  : http://${HOST}:${PORT}/api/health`);
  console.log('  First visit: create your own Content Manager account.');
  console.log('  Press Ctrl + C to stop the server.\n');
});

process.on('SIGINT', () => { console.log('\nServer stopped.'); process.exit(0); });
