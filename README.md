# EDCKPRCAS Corporate Website — Cloudflare Free with Online Content Manager

This is the deployment package for the existing EDCKPRCAS website. The public visual design, page copy, page structure, branding, supplied media and local Node.js preview are preserved. The deployment layer adds an online Content Manager backed by Cloudflare Pages Functions and Cloudflare D1.

## What is included

- Existing 14+ public website pages and the existing design system.
- Online Content Manager at `/content-manager/` (after the D1 database and secrets are configured).
- Legacy admin route `/admin/` pointing to the same Content Manager UI.
- Protected online CMS APIs for first-time administrator setup, login/logout, content editing, password changes, image/PDF uploads, social previews and enquiry inbox management.
- D1 storage for public content, administrator data, sessions, enquiry submissions and media files.
- Resend integration for sending contact-form enquiries to `edc@kprcas.ac.in`.
- Enquiry records remain in D1 even when email delivery is unavailable; the Content Manager displays email delivery status/errors.
- Static website assets and the existing official logo are bundled with Pages. No R2 bucket is required.
- Local Node.js preview and local Content Manager remain available through `start.bat`.
- `OPEN-ONLINE-CMS.bat` is an optional Windows shortcut that asks for the Pages hostname and opens the hosted CMS.

## Required free services

1. **GitHub Free private repository** — source backup and browser upload. Git for Windows / Git CLI is not needed if you upload through github.com.
2. **Cloudflare Pages Free** — public website and Pages Functions, with a free `*.pages.dev` address.
3. **Cloudflare D1 Free** — persistent online CMS content, enquiry, session and media storage. This is a database; it is required because the CMS must save edits after you close your computer. No R2 is used.
4. **Resend Free** — email delivery from the contact form. A sender domain that you are authorised to configure must be verified first.

Cloudflare D1's current Free limits include 500 MB per database, 5 GB total account storage, 5 million rows read/day, 100,000 rows written/day and a 2,000,000-byte maximum row/string/BLOB. This application stores uploaded media in 512 KiB chunks and stops new media uploads at an application cap of 450 MB to leave room for the content and enquiry tables. Individual uploads are limited to 12 MB. Review the live limits before launch.

Cloudflare Workers Free currently has a 100,000 requests/day limit and 10 ms CPU time per request; Pages Function calls count against that allowance. The build creates `_routes.json` to invoke Functions only for `/api/*`; ordinary public HTML, CSS, JavaScript and bundled image requests remain static asset requests. Keep the site within the free quotas.

## Important: what is local and what is online

- `http://localhost:3000/content-manager/` is the local editing/preview environment provided by `server.js`. It saves to local JSON files on your computer.
- `https://YOUR-PAGES-HOSTNAME.pages.dev/content-manager/` is the online Content Manager. It saves to Cloudflare D1 and updates the public website without a new deployment.
- These two content stores are separate. Local edits do not automatically sync to D1. Use the online CMS for normal production updates. You may use the CMS Export/Import backup to move JSON content between environments; media files must be uploaded separately in the online CMS.
- Source-code changes are different from content updates. A new commit/upload to the connected private GitHub repository triggers a Cloudflare Pages build. Normal CMS edits do not require GitHub or a rebuild.

## First-time setup — read these in order

1. `GITHUB-BROWSER-UPLOAD.md` — upload the extracted project files to your existing private repository through the GitHub website; do not upload the ZIP itself.
2. `FINAL-DEPLOYMENT-GUIDE.md` — connect the repository to Cloudflare Pages and publish the free `pages.dev` website first.
3. `ONLINE-CMS-SETUP.md` — create and seed D1, connect the `DB` binding, configure the one-time setup key and permanent password pepper, create the first online CMS administrator and confirm `/content-manager/` works.
4. `EMAIL-SETUP-FOR-BEGINNERS.md` — verify an authorised sender domain with Resend, create an API key, configure Cloudflare secrets and test a real enquiry at `edc@kprcas.ac.in`.
5. `CONTENT-UPDATES.md` — use the live online Content Manager after launch.

## Build configuration for Cloudflare Pages

- Framework preset: `None`
- Root directory: repository root `/`
- Production branch: `main`
- Build command: `node scripts/build-cloudflare.js`
- Build output directory: `dist`
- Build variables: `SITE_URL` and `MEDIA_BASE_URL`, both set to the actual `https://<project>.pages.dev` hostname initially.
- Keep `functions/` at the repository root (not inside `dist/`). Cloudflare Pages detects the functions from this folder.
- Create the D1 binding named exactly `DB` and redeploy after saving the binding.

## GitHub browser-upload safety

Upload the contents of the `kpr-corporate-suite` folder into the repository root, preserving folder structure. Do not upload the ZIP as one file. Do not upload `.env`, `.dev.vars`, `data/admin-auth.json`, `data/inquiries.json`, `dist/`, `node_modules/`, `.wrangler/`, `NODE_PATH.txt`, a portable `node.exe`, or real API keys/passwords. The GitHub browser uploader has a 100-file-per-batch and 25 MiB-per-file limit; this source package (without generated `dist/`) is below the per-batch count, but split it if your added media takes the count over 100.

This final package does not include a Render hosting configuration; the deployment target is Cloudflare Pages + D1 on Free plans.

## Email behaviour

A valid visitor enquiry is first saved to `cms_inquiries` in D1. The Pages Function then attempts to send it using the Resend API. The email is addressed to `MAIL_TO` (normally `edc@kprcas.ac.in`) and uses the visitor's address as `Reply-To`. The CMS Enquiry Inbox records whether Resend accepted the email and any provider error. The form does not send an automatic acknowledgement to the visitor in this version.

Do not announce the contact form as operational until the sender domain is verified, the Resend API key is stored as an encrypted Cloudflare Secret, a live enquiry reaches the institutional inbox, and Reply uses the visitor's address.

## Security and backups

- Keep the GitHub repository private.
- Keep `CMS_PASSWORD_PEPPER` as a permanent Cloudflare Secret and store a secure offline copy. Do not change or lose it after creating the online administrator; the stored password hash depends on it.
- `CMS_SETUP_TOKEN` is a temporary Secret used only for first-time administrator creation. Remove it after setup succeeds.
- Never commit `.env`, `.dev.vars`, real API keys, passwords, local admin hashes or local enquiry exports.
- Use a unique administrator username and a strong passphrase of at least 12–16 characters. Change it under Content Manager → Account security.
- Export the CMS JSON content backup regularly. That JSON export does not contain the binary media uploaded to D1; keep original image/PDF files in a separate institutional archive. Also export/backup the D1 database using Cloudflare's available D1 backup/export tools.
- Do not upload private student records, confidential documents or sensitive personal information as public website media.

## Local checks

Run from this project folder with Node.js 18 or newer:

```bash
node scripts/build-cloudflare.js
node scripts/cloudflare-smoke-test.js
node scripts/test-pages-function.cjs
node scripts/test-online-cms-function.cjs
node scripts/smoke-test.js
```

The Pages Function tests mock D1 and Resend; they do not send real email or replace the final live deployment test.
