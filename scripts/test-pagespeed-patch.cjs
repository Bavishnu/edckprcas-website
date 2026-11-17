#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const required = [
  'index.html', 'about.html', 'people.html', 'events.html', 'startups.html', 'impact.html',
  'messages.html', 'gallery.html', 'blogs.html', 'social-media.html', 'mentors.html',
  'annual-reports.html', 'contact.html', 'opportunities.html', 'achievements.html',
  '_headers', '_routes.json', 'robots.txt', 'sitemap.xml', 'assets/js/site.js',
  'assets/js/cloudflare-config.js', 'assets/css/site.css', 'data/site-data.json'
];
let passed = 0;
function check(condition, label) {
  if (!condition) throw new Error(`FAIL ${label}`);
  passed += 1;
  console.log(`PASS ${label}`);
}
if (!fs.existsSync(dist)) throw new Error('Build output not found. Run node scripts/build-cloudflare.js first.');
for (const name of required) check(fs.existsSync(path.join(dist, name)), `build includes ${name}`);

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const headers = fs.readFileSync(path.join(dist, '_headers'), 'utf8');
const api = fs.readFileSync(path.join(root, 'functions/api/[[path]].js'), 'utf8');
const site = fs.readFileSync(path.join(root, 'public/assets/js/site.js'), 'utf8');
check(/rel="canonical"/.test(html) && /name="robots"/.test(html), 'static canonical and robots metadata present');
check(/property="og:title"/.test(html) && /name="twitter:card"/.test(html), 'static social metadata present');
check(/site\.css\?v=[a-f0-9]{12}/.test(html) && /site\.js\?v=[a-f0-9]{12}/.test(html), 'versioned CSS and JS URLs generated');
check(/__EDCKPRCAS_MOTION_READY/.test(html) && !/<script\b[^>]*src=["'][^"']*gsap@3\.15\.0/i.test(html), 'GSAP is dynamically loaded instead of blocking HTML');
check(/family=DM\+Sans:wght@400\.\.800/.test(html), 'variable font request generated');
check(/max-age=31536000, immutable/.test(headers) && /\/uploads\/\*/.test(headers), 'long-lived immutable cache headers generated');
check(/x-edc-media-cache/.test(api) && /max-age=31536000, immutable/.test(api), 'D1 media API includes immutable edge/browser caching');
check(/x-edc-content-cache/.test(api) && /default\.delete/.test(api), 'public content API cache and CMS update invalidation are present');
check(/loading="\$\{priority \? 'eager' : 'lazy'\}"/.test(site) && /decoding="async"/.test(site), 'shared CMS image helper uses prioritised lazy/eager loading');
console.log(`\n${passed} PageSpeed patch static checks passed.`);
