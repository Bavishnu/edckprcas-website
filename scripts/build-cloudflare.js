#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist');
const DATA = path.join(ROOT, 'data', 'site-data.json');
const MAX_FILES = 20000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function loadLocalEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('=');
    if (at < 1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function copyTree(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    // Deploy the existing Content Manager interface as a private login screen.
    // Its protected API is implemented by Pages Functions and Cloudflare D1.
    // Public media remains bundled so no R2 bucket is required.
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

function inspectPagesLimits(directory) {
  let count = 0;
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(file);
      else {
        count += 1;
        const size = fs.statSync(file).size;
        if (size > MAX_FILE_BYTES) {
          throw new Error(`Cloudflare Pages asset exceeds 25 MiB: ${path.relative(OUT, file)} (${(size / 1024 / 1024).toFixed(2)} MiB). Compress or resize this file before deployment.`);
        }
      }
    }
  }
  walk(directory);
  if (count > MAX_FILES) throw new Error(`Cloudflare Pages Free supports up to 20,000 files per site; this build contains ${count}. Remove unused files or use an approved storage plan.`);
  return count;
}

function xml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}


function escapeHtmlAttribute(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function injectStaticSeo(outputDirectory, base, siteData) {
  const logoUrl = `${base}/uploads/edckprcas-official-logo.png`;
  const htmlFiles = [];
  function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(file);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) htmlFiles.push(file);
    }
  }
  collect(outputDirectory);
  let injectedCount = 0;
  for (const file of htmlFiles) {
    const relative = path.relative(outputDirectory, file).split(path.sep).join('/');
    if (relative.startsWith('content-manager/') || relative.startsWith('admin/')) continue;
    const canonical = relative === 'index.html' ? `${base}/` : `${base}/${relative}`;
    let html = fs.readFileSync(file, 'utf8');
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    let title = (titleMatch?.[1] || 'EDCKPRCAS | Entrepreneurship Development Cell').replace(/<[^>]+>/g, '').trim();
    const descriptionMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
    let description = descriptionMatch?.[1] || 'Entrepreneurship Development Cell at KPRCAS, Coimbatore.';
    if (relative === 'index.html') {
      title = 'EDCKPRCAS | Entrepreneurship Development Cell at KPRCAS, Coimbatore';
      description = 'EDCKPRCAS is the Entrepreneurship Development Cell at KPRCAS, Coimbatore, supporting student entrepreneurship, innovation, startup development, mentoring and campus programmes.';
      html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtmlAttribute(title)}</title>`);
      html = html.replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["'][^>]*>/i, `<meta name="description" content="${escapeHtmlAttribute(description)}">`);
    }
    const staticMeta = [
      `<link rel="canonical" href="${escapeHtmlAttribute(canonical)}">`,
      `<meta property="og:title" content="${escapeHtmlAttribute(title)}">`,
      `<meta property="og:description" content="${escapeHtmlAttribute(description)}">`,
      '<meta property="og:type" content="website">',
      `<meta property="og:url" content="${escapeHtmlAttribute(canonical)}">`,
      `<meta property="og:image" content="${escapeHtmlAttribute(logoUrl)}">`,
      '<meta property="og:image:alt" content="Official EDCKPRCAS logo">',
      '<meta name="robots" content="index,follow,max-image-preview:large">',
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${escapeHtmlAttribute(title)}">`,
      `<meta name="twitter:description" content="${escapeHtmlAttribute(description)}">`,
      `<meta name="twitter:image" content="${escapeHtmlAttribute(logoUrl)}">`
    ].join('\n  ');
    // Source HTML is copied fresh for each build, so a single static metadata block is safe.
    html = html.replace(/<\/head>/i, `  ${staticMeta}\n</head>`);
    if (relative === 'index.html') {
      const schema = {
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', '@id': `${base}/#website`, url: `${base}/`, name: 'EDCKPRCAS', alternateName: ['KPRCAS EDC', 'Entrepreneurship Development Cell at KPRCAS'] },
          { '@type': 'EducationalOrganization', '@id': `${base}/#organization`, name: 'EDCKPRCAS', alternateName: ['KPRCAS EDC', 'Entrepreneurship Development Cell at KPRCAS'], url: `${base}/`, description, email: siteData.site.email || 'edc@kprcas.ac.in', logo: logoUrl, address: { '@type': 'PostalAddress', addressLocality: 'Coimbatore', addressRegion: 'Tamil Nadu', addressCountry: 'IN' } }
        ]
      };
      const schemaTag = `<script type="application/ld+json" id="edc-static-seo-schema">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`;
      html = html.replace(/<\/head>/i, `  ${schemaTag}\n</head>`);
    }
    fs.writeFileSync(file, html, 'utf8');
    injectedCount += 1;
  }
  console.log(`Static SEO metadata added to ${injectedCount} public HTML pages (canonical, Open Graph, Twitter, organization schema).`);
}

function optimizeHtmlDelivery(outputDirectory) {
  const htmlFiles = [];
  function collect(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) collect(file);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) htmlFiles.push(file);
    }
  }
  collect(outputDirectory);

  const assetVersion = relativePath => {
    const fullPath = path.join(outputDirectory, relativePath);
    if (!fs.existsSync(fullPath)) throw new Error(`Required performance asset is missing: ${relativePath}`);
    return crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex').slice(0, 12);
  };
  const cssVersion = assetVersion('assets/css/site.css');
  const configVersion = assetVersion('assets/js/cloudflare-config.js');
  const siteVersion = assetVersion('assets/js/site.js');

  const motionBootstrap = `<script>
(() => {
  const desktopMotion = window.matchMedia('(min-width: 761px) and (prefers-reduced-motion: no-preference)').matches;
  if (!desktopMotion) {
    window.__EDCKPRCAS_MOTION_READY = Promise.resolve(false);
    return;
  }
  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = 'https://cdn.jsdelivr.net';
  preconnect.crossOrigin = 'anonymous';
  document.head.appendChild(preconnect);

  const isHome = location.pathname === '/' || location.pathname.toLowerCase().endsWith('/index.html');
  const sources = [
    'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js',
    'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/ScrollTrigger.min.js'
  ];
  if (isHome) sources.push('https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/Observer.min.js');

  const loadScript = src => new Promise(resolve => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    let settled = false;
    const finish = loaded => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (!loaded) script.remove();
      resolve(loaded);
    };
    const timer = window.setTimeout(() => finish(false), 2500);
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.head.appendChild(script);
  });

  window.__EDCKPRCAS_MOTION_READY = sources.reduce(
    (ready, src) => ready.then(loaded => loaded ? loadScript(src) : false),
    Promise.resolve(true)
  ).then(loaded => Boolean(loaded && window.gsap && window.ScrollTrigger))
    .catch(() => false);
})();
</script>`;

  let optimized = 0;
  for (const file of htmlFiles) {
    const relative = path.relative(outputDirectory, file).split(path.sep).join('/');
    if (relative.startsWith('content-manager/') || relative.startsWith('admin/')) continue;
    let html = fs.readFileSync(file, 'utf8');

    // One variable font file per family serves the required 400–800 weights.
    html = html.replace(
      /https:\/\/fonts\.googleapis\.com\/css2\?family=DM\+Sans:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap/g,
      'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400..800&family=Manrope:wght@400..800&display=swap'
    );

    // Do not block the content renderer on GSAP downloads. Mobile and reduced-
    // motion visits use the native fallback and do not download these libraries.
    html = html.replace(/\s*<script\b[^>]*src=["'][^"']*\/gsap@3\.15\.0\/dist\/(?:gsap|ScrollTrigger|Observer)\.min\.js["'][^>]*>\s*<\/script>/gi, '');

    if (!html.includes('window.__EDCKPRCAS_MOTION_READY')) {
      const configTag = /<script\b(?=[^>]*src=["']\/assets\/js\/cloudflare-config\.js["'])[^>]*>\s*<\/script>/i;
      if (configTag.test(html)) {
        html = html.replace(configTag, `${motionBootstrap}\n<script src="/assets/js/cloudflare-config.js" defer></script>`);
      } else {
        const siteTag = /<script\b(?=[^>]*src=["'](?:\/)?assets\/js\/site\.js["'])[^>]*>\s*<\/script>/i;
        if (siteTag.test(html)) html = html.replace(siteTag, `${motionBootstrap}\n$&`);
      }
    }

    // Fingerprint local CSS/JS URLs so the static assets can be cached as
    // immutable for a year without serving stale code after a new deployment.
    html = html.replace(/href=(["'])(\/)?assets\/css\/site\.css(?:\?[^"']*)?\1/i, `href="$2assets/css/site.css?v=${cssVersion}"`);
    html = html.replace(/src=(["'])\/assets\/js\/cloudflare-config\.js(?:\?[^"']*)?\1/i, `src="/assets/js/cloudflare-config.js?v=${configVersion}"`);
    html = html.replace(/src=(["'])(\/)?assets\/js\/site\.js(?:\?[^"']*)?\1/i, `src="$2assets/js/site.js?v=${siteVersion}"`);

    fs.writeFileSync(file, html, 'utf8');
    optimized += 1;
  }
  console.log(`Optimized HTML delivery on ${optimized} public pages (variable fonts; desktop-only optional motion libraries).`);
}

function main() {
  loadLocalEnv();
  if (!fs.existsSync(DATA)) throw new Error('data/site-data.json was not found. Run this from the project root.');
  const siteData = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  if (!siteData.site || typeof siteData.site !== 'object') throw new Error('The site-data.json structure is invalid.');

  const base = String(process.env.SITE_URL || 'https://edckprcas-website.pages.dev').trim().replace(/\/$/, '');
  let parsedBase;
  try { parsedBase = new URL(base); } catch { throw new Error('SITE_URL must be a complete https:// URL.'); }
  if (parsedBase.protocol !== 'https:') throw new Error('SITE_URL must use https://.');

  // Without R2, the uploaded files are served from the same Pages hostname.
  // MEDIA_BASE_URL is optional only for a future separately hosted media CDN.
  const mediaBase = String(process.env.MEDIA_BASE_URL || base).trim().replace(/\/$/, '');
  let parsedMedia;
  try { parsedMedia = new URL(mediaBase); } catch { throw new Error('MEDIA_BASE_URL must be a complete https:// URL.'); }
  if (parsedMedia.protocol !== 'https:') throw new Error('MEDIA_BASE_URL must use https://.');

  fs.rmSync(OUT, { recursive: true, force: true });
  copyTree(PUBLIC, OUT);
  injectStaticSeo(OUT, base, siteData);

  const logo = path.join(OUT, 'uploads', 'edckprcas-official-logo.png');
  if (!fs.existsSync(logo)) throw new Error('The official EDC logo is missing from public/uploads. Restore it before building.');

  // Inject the public media URL; no API credentials or other secrets are written to dist.
  const configFile = path.join(OUT, 'assets', 'js', 'cloudflare-config.js');
  if (!fs.existsSync(configFile)) throw new Error('public/assets/js/cloudflare-config.js is missing.');
  const configSource = fs.readFileSync(configFile, 'utf8');
  if (!configSource.includes('__EDCKPRCAS_MEDIA_BASE_URL__')) throw new Error('Media URL token is missing from cloudflare-config.js.');
  fs.writeFileSync(configFile, configSource.replace('__EDCKPRCAS_MEDIA_BASE_URL__', JSON.stringify(mediaBase)), 'utf8');

  optimizeHtmlDelivery(OUT);

  const publishedData = { ...siteData, site: { ...siteData.site, website: base } };
  fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'data', 'site-data.json'), JSON.stringify(publishedData, null, 2), 'utf8');

  const pages = ['', 'about.html', 'people.html', 'events.html', 'startups.html', 'impact.html', 'messages.html', 'gallery.html', 'blogs.html', 'social-media.html', 'mentors.html', 'annual-reports.html', 'contact.html', 'opportunities.html', 'achievements.html'];
  const urls = pages.map(page => `<url><loc>${xml(base + (page ? '/' + page : '/'))}</loc></url>`);
  (siteData.teams || []).filter(team => team.yearKey).forEach(team => urls.push(`<url><loc>${xml(`${base}/team.html?year=${encodeURIComponent(team.yearKey)}`)}</loc></url>`));
  (siteData.blogs || []).filter(item => {
    const status = String(item.status || 'Published').toLowerCase();
    const time = item.publishAt ? new Date(item.publishAt).getTime() : 0;
    return !['draft', 'unpublished', 'hidden'].includes(status) && !(time > Date.now()) && status !== 'scheduled';
  }).forEach(item => urls.push(`<url><loc>${xml(`${base}/blog.html?id=${encodeURIComponent(item.id)}`)}</loc></url>`));
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /content-manager/\nDisallow: /admin/\nSitemap: ${base}/sitemap.xml\n`, 'utf8');
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`, 'utf8');
  fs.writeFileSync(path.join(OUT, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/data/site-data.json
  Cache-Control: no-store
/content-manager/*
  Cache-Control: no-store
/admin/*
  Cache-Control: no-store
/assets/js/admin.js
  Cache-Control: no-store
/assets/js/site.js
  Cache-Control: public, max-age=31536000, immutable
/assets/js/cloudflare-config.js
  Cache-Control: public, max-age=31536000, immutable
/assets/css/site.css
  Cache-Control: public, max-age=31536000, immutable
/favicon-theme.svg
  Cache-Control: no-cache
/uploads/*
  Cache-Control: public, max-age=86400
`, 'utf8');

  // Only API paths invoke Pages Functions. All public HTML, CSS, JS and media
  // are served as static assets and do not consume Function requests.
  fs.writeFileSync(path.join(OUT, '_routes.json'), JSON.stringify({ version: 1, include: ['/api/*'], exclude: [] }, null, 2), 'utf8');

  const fileCount = inspectPagesLimits(OUT);
  console.log(`Cloudflare Pages build complete: ${OUT}`);
  console.log(`Site URL: ${base}`);
  console.log(`Media URL: ${mediaBase}`);
  console.log(`Files included: ${fileCount} (Free plan maximum: ${MAX_FILES})`);
  console.log('Included: public HTML/assets, /content-manager/, /admin/, public/uploads media, and the read-only static content fallback.');
  console.log('Online CMS APIs and enquiry storage are provided by Pages Functions + the D1 binding named DB.');
  console.log('Configure and seed the D1 database before expecting online sign-in, editing, uploads or enquiry inbox to work.');
  console.log('No R2 bucket or paid media add-on is required. Online CMS media is stored in D1 within its free storage quota.');
}
try { main(); } catch (error) { console.error(`BUILD FAILED: ${error.message}`); process.exit(1); }
