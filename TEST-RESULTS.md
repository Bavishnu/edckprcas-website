# EDCKPRCAS online-CMS package validation

## Local automated checks

Latest validation in the working package:

- `node --check server.js` — passed.
- `node --check public/assets/js/site.js` — passed.
- `node --check public/assets/js/admin.js` — passed.
- `node --check functions/_lib/cms.js` — passed.
- `node --check "functions/api/[[path]].js"` — passed.
- `node --check functions/api/contact.js` — passed.
- `node --check scripts/build-cloudflare.js` — passed.
- Cloudflare Pages build — passed; included public pages, `/content-manager/`, `/admin/`, static assets and official logo.
- Cloudflare online-CMS build assertions — passed.
- Pages contact Function mock suite — 13 checks passed with mocked D1 and Resend; no live email was sent.
- Online CMS Pages Function mock suite — 17 checks passed for first admin setup, session cookie, authentication, content read/save, D1 media upload/retrieval, enquiry inbox and status updates; D1 was in-memory mocked.
- Local Node application regression suite — 48 checks passed.
- D1 schema and seed migration — validated against SQLite; one initial content record was inserted.
- ZIP archive integrity — checked after packaging.

## What the tests do not prove

- The package has not been deployed to the user's Cloudflare account.
- No actual D1 database has been provisioned or bound to the user's Pages project.
- First administrator setup, live login, CMS edit, real D1 media upload and persistence after browser restart still require production testing.
- No actual Resend email has been sent. A real API key, authorised sender-domain DNS verification and test form submission are required.
- The final `edckprcas.co.in` DNS connection has not been made and requires the domain owner's permission.

## Run the local checks

From the project root with Node.js 18 or newer:

```powershell
node --check server.js
node --check public/assets/js/site.js
node --check public/assets/js/admin.js
node --check functions/_lib/cms.js
node --check "functions/api/[[path]].js"
node --check functions/api/contact.js
node scripts/build-cloudflare.js
node scripts/cloudflare-smoke-test.js
node scripts/test-pages-function.cjs
node scripts/test-online-cms-function.cjs
node scripts/smoke-test.js
```

The Pages Function tests use mock objects and do not replace the real Cloudflare/D1/Resend launch test.
