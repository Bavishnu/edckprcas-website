'use strict';
// Portable Node.js smoke/regression suite. Uses only Node built-ins and the project server.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const port = 31000 + Math.floor(Math.random() * 12000);
const base = `http://127.0.0.1:${port}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'edckprcas-smoke-'));
const dataDir = path.join(temp, 'data');
const uploadDir = path.join(temp, 'uploads');
fs.mkdirSync(dataDir, { recursive: true });
fs.copyFileSync(path.join(root, 'data', 'site-data.json'), path.join(dataDir, 'site-data.json'));
const seededContent = JSON.parse(fs.readFileSync(path.join(dataDir, 'site-data.json'), 'utf8'));
const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const due = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
seededContent.blogs = [...(seededContent.blogs || []),
  { id: 'smoke-future-scheduled', title: 'Future scheduled smoke article', status: 'Scheduled', publishAt: future, excerpt: 'Must remain hidden until due.' },
  { id: 'smoke-due-scheduled', title: 'Due scheduled smoke article', status: 'Scheduled', publishAt: due, excerpt: 'Must become public after its date.' },
  { id: 'smoke-private-draft', title: 'Private draft smoke article', status: 'Draft', excerpt: 'Must remain private.' }
];
fs.writeFileSync(path.join(dataDir, 'site-data.json'), JSON.stringify(seededContent, null, 2));
const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, UPLOAD_DIR: uploadDir, SITE_URL: base },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
child.stdout.on('data', chunk => { logs += chunk.toString(); });
child.stderr.on('data', chunk => { logs += chunk.toString(); });
let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  passed += 1; process.stdout.write(`PASS ${message}\n`);
}
async function request(route, options = {}) {
  const response = await fetch(base + route, options);
  return response;
}
async function waitForServer() {
  const until = Date.now() + 12000;
  while (Date.now() < until) {
    try { const response = await request('/api/health'); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Server did not start. Logs:\n${logs}`);
}
(async () => {
  try {
    await waitForServer();
    const health = await (await request('/api/health')).json();
    assert(health.ok === true, 'health endpoint');

    const faviconWhite = await request('/edckprcas-favicon-white-32.png');
    assert(faviconWhite.status === 200 && (await faviconWhite.arrayBuffer()).byteLength > 100, 'white transparent favicon for dark theme is served');
    const faviconDark = await request('/edckprcas-favicon-dark-32.png');
    assert(faviconDark.status === 200 && (await faviconDark.arrayBuffer()).byteLength > 100, 'navy transparent favicon for light theme is served');
    const faviconWhiteIco = await request('/edckprcas-favicon-white.ico');
    assert(faviconWhiteIco.status === 200 && (await faviconWhiteIco.arrayBuffer()).byteLength > 100, 'white theme-specific ICO is served');
    const faviconDarkIco = await request('/edckprcas-favicon-dark.ico');
    assert(faviconDarkIco.status === 200 && (await faviconDarkIco.arrayBuffer()).byteLength > 100, 'navy theme-specific ICO is served');
    const faviconFallback = await request('/favicon.ico');
    assert(faviconFallback.status === 200 && (await faviconFallback.arrayBuffer()).byteLength > 100, 'standard root favicon fallback is served');
    const faviconSvg = await request('/favicon-theme.svg');
    const faviconSvgText = await faviconSvg.text();
    assert(faviconSvg.status === 200 && faviconSvgText.includes('prefers-color-scheme: dark') && faviconSvgText.includes('prefers-color-scheme: light'), 'SVG favicon automatically switches for light and dark themes');
    const faviconCacheCheck = await request('/edckprcas-favicon-white-32.png');
    assert((faviconCacheCheck.headers.get('cache-control') || '').includes('no-store'), 'favicon responses are not cached by the server');
    const appleTouchIcon = await request('/apple-touch-icon.png');
    assert(appleTouchIcon.status === 200 && (await appleTouchIcon.arrayBuffer()).byteLength > 100, '180px Apple touch icon is served');

    const routes = [
      '/', '/about.html', '/people.html', '/events.html', '/startups.html', '/impact.html',
      '/messages.html', '/gallery.html', '/blogs.html', '/social-media.html', '/mentors.html',
      '/annual-reports.html', '/contact.html', '/opportunities.html', '/achievements.html',
      '/team.html?year=2024-2025', '/team.html?year=2025-2026', '/team.html?year=2026-2027',
      '/blog.html', '/content-manager/', '/admin/'
    ];
    for (const route of routes) {
      const response = await request(route);
      assert(response.status === 200, `GET ${route}`);
    }

    const robots = await (await request('/robots.txt')).text();
    assert(robots.includes(`Sitemap: ${base}/sitemap.xml`), 'robots.txt advertises sitemap');
    assert(robots.includes('Disallow: /content-manager/'), 'robots excludes Content Manager');
    const sitemap = await (await request('/sitemap.xml')).text();
    assert(sitemap.includes(`${base}/achievements.html`), 'sitemap includes Achievements');
    assert(sitemap.includes(`${base}/team.html?year=2026-2027`), 'sitemap includes academic team route');
    assert(sitemap.includes('smoke-due-scheduled'), 'sitemap publishes a scheduled article after its publication time');
    assert(!sitemap.includes('smoke-future-scheduled'), 'sitemap excludes a future scheduled article');
    assert(!sitemap.includes('smoke-private-draft'), 'sitemap excludes draft articles');

    const setup = await request('/api/admin/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'smoketest', password: 'Smoke-Test-Password-2026!' })
    });
    assert(setup.status === 201, 'first-time Content Manager setup');
    const cookie = (setup.headers.get('set-cookie') || '').split(';')[0];
    assert(Boolean(cookie), 'Content Manager session cookie created');

    const adminRead = await request('/api/admin/data', { headers: { Cookie: cookie } });
    assert(adminRead.status === 200, 'authenticated CMS content read');
    const content = await adminRead.json();
    const update = await request('/api/admin/data', {
      method: 'PUT', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(content)
    });
    assert(update.status === 200, 'CMS section data save API');

    const imageBytes = fs.readFileSync(path.join(root, 'public', 'edckprcas-favicon-64.png'));
    const upload = await request('/api/admin/upload?filename=smoke-test.png', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'image/png' }, body: imageBytes
    });
    assert(upload.status === 201, 'authenticated image upload');
    const uploadResult = await upload.json();
    const uploadedFile = await request(uploadResult.url);
    assert(uploadedFile.status === 200, 'uploaded image can be served publicly');

    const unsafePreview = await request('/api/admin/social-preview', {
      method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com/test-post' })
    });
    assert(unsafePreview.status === 422, 'social thumbnail endpoint rejects non-social hosts safely');

    const contact = await request('/api/contact', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'EDC Smoke Test', email: 'smoke@example.com', subject: 'Regression test', message: 'This is a test enquiry to verify the inbox flow.' })
    });
    assert(contact.status === 201, 'public contact form accepts a valid enquiry');
    const contactResult = await contact.json();
    assert(contactResult.emailSent === false, 'local email delivery accurately reports missing provider configuration');
    const inboxResponse = await request('/api/admin/inquiries', { headers: { Cookie: cookie } });
    assert(inboxResponse.status === 200, 'authenticated enquiry inbox');
    const inbox = await inboxResponse.json();
    assert(inbox.some(item => item.email === 'smoke@example.com'), 'submitted enquiry appears in Content Manager inbox');

    process.stdout.write(`\n${passed} smoke/regression checks passed.\n`);
  } catch (error) {
    process.stderr.write(`\n${error.stack || error}\n\nServer log:\n${logs}\n`);
    process.exitCode = 1;
  } finally {
    child.kill('SIGTERM');
    fs.rmSync(temp, { recursive: true, force: true });
  }
})();
