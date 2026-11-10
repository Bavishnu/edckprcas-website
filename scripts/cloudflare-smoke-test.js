#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const required = [
  'index.html','about.html','people.html','events.html','startups.html','impact.html','messages.html','gallery.html',
  'blogs.html','social-media.html','mentors.html','annual-reports.html','contact.html','opportunities.html','achievements.html',
  'blog.html','team.html','data/site-data.json','robots.txt','sitemap.xml','favicon-theme.svg','assets/js/site.js',
  'assets/js/cloudflare-config.js','uploads/edckprcas-official-logo.png','content-manager/index.html','admin/index.html',
  'assets/js/admin.js','assets/css/admin.css','_routes.json'
];
let failed = 0;
function assert(condition, label) {
  if (condition) console.log(`PASS ${label}`);
  else { console.error(`FAIL ${label}`); failed += 1; }
}
for (const file of required) assert(fs.existsSync(path.join(dist, file)), `built asset ${file}`);
const robots = fs.readFileSync(path.join(dist, 'robots.txt'), 'utf8');
assert(robots.includes('Disallow: /content-manager/'), 'robots excludes Content Manager from indexing');
assert(robots.includes('Disallow: /admin/'), 'robots excludes admin alias from indexing');
const routes = JSON.parse(fs.readFileSync(path.join(dist, '_routes.json'), 'utf8'));
assert(routes.version === 1 && routes.include.includes('/api/*'), 'Pages Functions run only for API paths');
const html = fs.readFileSync(path.join(dist, 'contact.html'), 'utf8');
assert(html.includes('cloudflare-config.js') && html.includes('favicon-theme.svg'), 'contact page config and themed favicon');
const js = fs.readFileSync(path.join(dist, 'assets/js/site.js'), 'utf8');
assert(js.includes("fetch('/api/content'") && js.includes("fetch('/data/site-data.json'"), 'public site reads live D1 content with static fallback');
const cfConfig = fs.readFileSync(path.join(dist, 'assets/js/cloudflare-config.js'), 'utf8');
assert(!cfConfig.includes('__EDCKPRCAS_MEDIA_BASE_URL__'), 'media URL token replaced');
const fnFiles = [
  'functions/api/contact.js', 'functions/api/[[path]].js', 'functions/_lib/cms.js',
  'migrations/0001_initial.sql', 'migrations/0002_seed_initial_content.sql'
];
for (const file of fnFiles) assert(fs.existsSync(path.join(root, file)), `online CMS source ${file}`);
const contact = fs.readFileSync(path.join(root, 'functions/api/contact.js'), 'utf8');
assert(contact.includes('cms_inquiries') && contact.includes('reply_to: email'), 'enquiry persistence and visitor Reply-To');
const api = fs.readFileSync(path.join(root, 'functions/api/[[path]].js'), 'utf8');
for (const route of ['/api/admin/setup','/api/admin/login','/api/admin/data','/api/admin/upload','/api/admin/inquiries']) {
  assert(api.includes(route), `online CMS route ${route}`);
}
if (failed) process.exit(1);
console.log('Cloudflare online-CMS build checks passed.');
