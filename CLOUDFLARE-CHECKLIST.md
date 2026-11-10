# EDCKPRCAS Free Cloudflare + Online CMS launch checklist

## GitHub source backup
- [ ] Keep the repository private.
- [ ] Upload the contents of `kpr-corporate-suite` through the GitHub website (no Git CLI required).
- [ ] Ensure the repository root contains `functions/`, `migrations/`, `public/`, `scripts/`, `data/site-data.json`, `server.js` and `wrangler.toml`.
- [ ] Do not upload `.env`, `.dev.vars`, `data/admin-auth.json`, `data/inquiries.json`, `dist/`, `.wrangler/`, `node_modules/`, `NODE_PATH.txt`, portable `node.exe` or real secrets.
- [ ] Remove any old `render.yaml` and obsolete `PUBLISH-UPDATES.bat` from earlier packages.

## Cloudflare Pages
- [ ] Create Pages using **Connect to Git** (not Direct Upload/drag-and-drop).
- [ ] Connect the private GitHub repository and the `main` branch.
- [ ] Framework preset: None; root `/`; build `node scripts/build-cloudflare.js`; output `dist`.
- [ ] Set build-time `SITE_URL` and `MEDIA_BASE_URL` to the exact Pages hostname.
- [ ] Confirm the public website, routes, image files, logo, favicon and sitemap.

## D1 online Content Manager
- [ ] Create D1 database `edckprcas-online-cms` on Free.
- [ ] Run `migrations/0001_initial.sql` in D1 Console.
- [ ] Run `migrations/0002_seed_initial_content.sql` once.
- [ ] Add D1 binding to Pages with variable name exactly `DB`.
- [ ] Add `CMS_SETUP_TOKEN` and `CMS_PASSWORD_PEPPER` as encrypted Production Secrets.
- [ ] Add `ALLOWED_ORIGINS` as a Production variable for the Pages origin.
- [ ] Redeploy after binding/secrets are saved.
- [ ] Check `/api/health` and `/api/auth/status`.
- [ ] Open hosted `/content-manager/`, create first admin, then delete `CMS_SETUP_TOKEN` but keep `CMS_PASSWORD_PEPPER`.
- [ ] Test online content save, media upload and Enquiry inbox.

## Email
- [ ] Create Resend Free account.
- [ ] Verify an authorised sender domain with the DNS records Resend provides.
- [ ] Create Resend sending API key.
- [ ] Add `RESEND_API_KEY` as an encrypted Secret.
- [ ] Add `MAIL_FROM`, `MAIL_TO=edc@kprcas.ac.in` and `ALLOWED_ORIGINS`.
- [ ] Redeploy and submit a real enquiry.
- [ ] Confirm arrival in the institutional inbox and correct Reply-To.
- [ ] Check the online CMS Enquiry Inbox for email status/errors.

## Official domain later
- [ ] Obtain domain owner's explicit DNS permission.
- [ ] Prefer `edc.edckprcas.co.in` if the owner only permits a CNAME; use the root domain only if they approve Cloudflare nameservers.
- [ ] Preserve existing MX, SPF, DKIM, DMARC and verification records.
- [ ] Add the custom domain in Pages before creating the CNAME.
- [ ] Update build variables and the `ALLOWED_ORIGINS` runtime variable.
- [ ] Redeploy and retest public pages, CMS login, content save, media upload and email.

## Backups
- [ ] Export online CMS JSON content regularly.
- [ ] Keep original binary media separately on an institutional drive.
- [ ] Back up/export the D1 database.
- [ ] Keep `CMS_PASSWORD_PEPPER` in a secure offline record.

**No R2 bucket, PostgreSQL service or Render service is required for this architecture. Stay on the Free plans; do not enable paid upgrades or pay-as-you-go.**
