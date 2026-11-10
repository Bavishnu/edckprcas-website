#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
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

  const logo = path.join(OUT, 'uploads', 'edckprcas-official-logo.png');
  if (!fs.existsSync(logo)) throw new Error('The official EDC logo is missing from public/uploads. Restore it before building.');

  // Inject the public media URL; no API credentials or other secrets are written to dist.
  const configFile = path.join(OUT, 'assets', 'js', 'cloudflare-config.js');
  if (!fs.existsSync(configFile)) throw new Error('public/assets/js/cloudflare-config.js is missing.');
  const configSource = fs.readFileSync(configFile, 'utf8');
  if (!configSource.includes('__EDCKPRCAS_MEDIA_BASE_URL__')) throw new Error('Media URL token is missing from cloudflare-config.js.');
  fs.writeFileSync(configFile, configSource.replace('__EDCKPRCAS_MEDIA_BASE_URL__', JSON.stringify(mediaBase)), 'utf8');

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
  fs.writeFileSync(path.join(OUT, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n/data/site-data.json\n  Cache-Control: no-store\n/content-manager/*\n  Cache-Control: no-store\n/admin/*\n  Cache-Control: no-store\n/assets/js/admin.js\n  Cache-Control: no-store\n/favicon-theme.svg\n  Cache-Control: no-cache\n/uploads/*\n  Cache-Control: public, max-age=86400\n`, 'utf8');

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
