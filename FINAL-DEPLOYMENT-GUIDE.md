# Final deployment guide — EDCKPRCAS online CMS on Cloudflare Free

This is the intended production route for this package. It gives you:

- Cloudflare Pages Free for the public website and Pages Functions;
- Cloudflare D1 Free for the online Content Manager, accounts, enquiries and uploaded media;
- Resend Free for contact-form email delivery;
- your free `*.pages.dev` hosting subdomain first;
- `edckprcas.co.in` later, after the domain owner authorises DNS changes.

**No Git command-line installation is required.** You can upload source files to GitHub with the GitHub website. Cloudflare connects to that private repository and builds it automatically. Do not use Cloudflare's drag-and-drop Direct Upload for this plan: this project needs Pages Functions, and Cloudflare treats Direct Upload and Git integration as different project types.

## Stage 0 — Keep a backup and identify the correct package

1. Keep the original ZIPs somewhere safe; do not overwrite your only copy.
2. Extract this final online-CMS package.
3. Open the `kpr-corporate-suite` folder. This folder contains the project root.
4. Do not combine it with an older static-only ZIP or nest one copy inside another.
5. The website's page design, content, logo, media, typography and existing local preview are preserved. The deployment additions are the Pages Functions and D1 CMS backend.

## Stage 1 — Preview locally

1. Install Node.js 18 or newer, or use your existing portable Node.js installation.
2. Double-click `start.bat` from the project folder.
3. Open `http://localhost:3000/`.
4. Open `http://localhost:3000/content-manager/` to check the local preview CMS.
5. Confirm the pages and existing media look correct.

The local CMS is a separate preview environment. The live CMS will use D1 after the online setup below.

## Stage 2 — Upload the source to your private GitHub repository using the browser

1. Open your already-created private repository on `https://github.com/`.
2. If the repository is empty, select **Add file → Upload files**.
3. If it contains the previous static-only website package, replace the overlapping files with the files from this final online-CMS package. Ensure the new `functions/`, `migrations/`, CMS assets and build script are uploaded. Remove stale generated `dist/` output.
4. Upload the **contents** of `kpr-corporate-suite` into the repository root. Do not upload the ZIP itself or an extra parent folder.
5. Preserve the folder structure. In particular, `functions/`, `migrations/`, `public/`, `scripts/` and `data/` must be directly under the repository root.
6. Include `.gitignore`, `.env.example` and `.dev.vars.example`. Enable Windows File Explorer → View → Show → Hidden items to see dotfiles.
7. Do not upload `.env`, `.dev.vars`, `data/admin-auth.json`, `data/inquiries.json`, `dist/`, `node_modules/`, `.wrangler/`, `NODE_PATH.txt`, a portable `node.exe`, ZIP files or real credentials/API keys.
8. Remove any older `render.yaml` from the repository. The final package does not use Render.
9. Commit the uploaded files to the `main` branch using GitHub's **Commit changes** button.

GitHub's browser upload currently allows up to 100 files per batch and 25 MiB per file. This project's source is below 100 files before you add extra media; if your repository has more than 100 files, split the upload into batches while preserving paths. Do not upload any single file over 25 MiB.

### Important file replacement checklist

Keep the existing public website properties. Do not delete the public HTML pages, CSS, frontend JS, official logo, `data/site-data.json`, local `server.js`, `start.bat`, or approved media.

The following files are required for the online CMS and should be added/replaced from this final package:

- `functions/_lib/cms.js`
- `functions/api/[[path]].js`
- `functions/api/contact.js`
- `migrations/0001_initial.sql`
- `migrations/0002_seed_initial_content.sql`
- `public/content-manager/index.html`
- `public/admin/index.html`
- `public/assets/js/admin.js`
- `public/assets/js/site.js`
- `public/assets/js/cloudflare-config.js`
- `scripts/build-cloudflare.js`
- `scripts/cloudflare-smoke-test.js`
- `scripts/test-pages-function.cjs`
- `ONLINE-CMS-SETUP.md`
- `GITHUB-BROWSER-UPLOAD.md`

The whole extracted project is safer than selecting only a few files. The list above identifies the critical additions/updates; it is not a list of files to delete from the website.

## Stage 3 — Create the Cloudflare Pages project using Git integration

1. Create/sign in to Cloudflare: `https://dash.cloudflare.com/`.
2. Open **Workers & Pages**.
3. Select **Create application** → **Pages** → **Connect to Git**.
4. Authorise Cloudflare's GitHub app and permit access to your private EDCKPRCAS repository.
5. Select the private repository and the `main` branch.
6. Project name: `edckprcas-website` if available. Otherwise use the available name and note the exact Pages hostname.
7. Framework preset: `None`.
8. Root directory: repository root `/` (or leave blank if the dashboard uses blank for root).
9. Production branch: `main`.
10. Build command: `node scripts/build-cloudflare.js`.
11. Build output directory: `dist`.
12. Add the build-time Production variables below, replacing the hostname with the exact hostname Cloudflare assigns:

| Variable | Initial value |
|---|---|
| `SITE_URL` | `https://YOUR-PAGES-HOSTNAME.pages.dev` |
| `MEDIA_BASE_URL` | `https://YOUR-PAGES-HOSTNAME.pages.dev` |

13. Select **Save and Deploy**. Wait for the build to complete.
14. Open the actual `https://YOUR-PAGES-HOSTNAME.pages.dev` address.

Cloudflare automatically builds again when new browser commits are made to the connected GitHub branch. You do not need to install Git or use terminal Git commands. A Git-integrated Pages project cannot later be converted into a Direct Upload project; choose **Connect to Git** now for this workflow.

## Stage 4 — Create and seed the free online CMS database

The public website can display the bundled starter content after its first build. The online CMS login, edits, uploads and enquiry inbox need D1 to be set up.

1. In Cloudflare Dashboard, open **D1** (it may be under Storage & Databases).
2. Select **Create database**.
3. Name it `edckprcas-online-cms` and keep it on the Free plan.
4. Open the database's SQL Console.
5. Open `migrations/0001_initial.sql` from your extracted project in a text editor. Copy the entire SQL file into the D1 Console and run it.
6. Open `migrations/0002_seed_initial_content.sql`. Copy the entire SQL file into the D1 Console and run it once. This imports the starting site content into D1. It uses insert-if-absent logic and does not overwrite later edits if run again.
7. Verify with:

```sql
SELECT COUNT(*) AS content_records FROM cms_content;
```

The result should be `1`.

8. Open Workers & Pages → your Pages project → **Settings → Bindings**.
9. Select **Add** → **D1 database binding**.
10. Variable name must be exactly `DB` (uppercase). Select `edckprcas-online-cms` as the database and save.
11. Redeploy the latest production deployment so the Pages Functions receive the database binding.

Follow `ONLINE-CMS-SETUP.md` for the complete first-admin setup and secret configuration.

## Stage 5 — Configure the online CMS administrator

1. Generate two different random secrets on your computer using Node.js:

```bat
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run the command twice. Store the first value as the temporary `CMS_SETUP_TOKEN` and the second as the permanent `CMS_PASSWORD_PEPPER` in a secure password manager or institutional record.

2. In Cloudflare Pages → Settings → Variables and Secrets → Production, create:

| Name | Type | Value |
|---|---|---|
| `CMS_SETUP_TOKEN` | Secret | First 64-character value |
| `CMS_PASSWORD_PEPPER` | Secret | Second 64-character value |
| `ALLOWED_ORIGINS` | Plain variable | `https://YOUR-PAGES-HOSTNAME.pages.dev` |

3. Save and redeploy.
4. Open `https://YOUR-PAGES-HOSTNAME.pages.dev/api/health`. It should report `ok: true` and Cloudflare D1 storage.
5. Open `https://YOUR-PAGES-HOSTNAME.pages.dev/api/auth/status`. Before the first account is created, it should report `setupRequired: true`.
6. Open `https://YOUR-PAGES-HOSTNAME.pages.dev/content-manager/`.
7. Create a unique administrator username and a strong, unique passphrase (prefer 16 or more characters). Enter the temporary setup key when the form asks for it.
8. After the dashboard opens, return to Cloudflare Variables and Secrets and delete only `CMS_SETUP_TOKEN`.
9. Keep `CMS_PASSWORD_PEPPER` permanently. Never change or lose it after the administrator is created. Redeploy after removing the temporary token.
10. Test a text edit, a test record, an image upload and the Enquiry inbox. The public website should display saved content after refresh without a new build.

## Stage 6 — Configure enquiry emails

Follow `EMAIL-SETUP-FOR-BEGINNERS.md` step by step. The short version is:

1. Create a Resend Free account.
2. Verify an authorised sender domain with DNS records supplied by Resend (prefer `send.kprcas.ac.in` with KPRCAS IT approval; otherwise use `send.edckprcas.co.in` after your friend grants DNS permission).
3. Create a Resend API key with sending-only permission if available.
4. Add `RESEND_API_KEY` as an encrypted Cloudflare Secret. Add `MAIL_FROM` and `MAIL_TO` as plain variables. Keep `MAIL_TO=edc@kprcas.ac.in`.
5. Include the exact Pages origin in `ALLOWED_ORIGINS`.
6. Redeploy and send a real test through the public Reach Us form.
7. Confirm the message arrives at `edc@kprcas.ac.in` and the CMS Enquiry Inbox shows the email status.

The enquiry is written into D1 before the Function tries to send the email. If Resend is not configured or rejects the request, the saved enquiry remains in the online CMS and the visitor sees an honest delivery-status message. The Function sets the visitor's address as Reply-To. It does not send an automatic acknowledgement to the visitor in this release.

## Stage 7 — Connect the official domain later

Keep the free Pages hostname working until the domain owner grants the required permission.

### Preferred when you only receive permission to add a DNS record

Use an EDC subdomain such as `edc.edckprcas.co.in`.

1. In Pages → Custom Domains, add `edc.edckprcas.co.in` first.
2. Cloudflare will display the exact CNAME target. Send that exact value to your friend/domain owner.
3. The owner adds the CNAME in the existing DNS provider.
4. Verify the custom domain and wait for HTTPS to become active.
5. Update `SITE_URL` and `MEDIA_BASE_URL` to `https://edc.edckprcas.co.in` in the Pages **build environment**.
6. Update the Function runtime variable `ALLOWED_ORIGINS` to include both the Pages origin and `https://edc.edckprcas.co.in` (comma-separated, no trailing slashes).
7. Redeploy and retest the website, CMS login, CMS upload and contact form.

### If you receive permission to manage the root domain

You may connect `edckprcas.co.in` and optionally `www.edckprcas.co.in`. A custom apex domain on Pages must be a Cloudflare zone with Cloudflare nameservers. Before changing nameservers, copy/import and verify all existing DNS records, especially MX, SPF, DKIM, DMARC and verification TXT records. Do not delete or replace institutional email records. The domain owner must approve the nameserver change at the registrar.

The Resend sender domain can remain `send.kprcas.ac.in` if KPRCAS IT verified it. It does not need to change just because the website hostname changes. If the sender is instead `send.edckprcas.co.in`, preserve its Resend DNS records when connecting the main domain.

For the root domain, update the build variables to `https://edckprcas.co.in`, and set `ALLOWED_ORIGINS` to include the exact live origins, for example:

`https://YOUR-PAGES-HOSTNAME.pages.dev,https://edckprcas.co.in,https://www.edckprcas.co.in`

Use only the origins you have actually configured. Redeploy and repeat the live email test.

## Free-plan fit and limitations

- Cloudflare Pages Free provides the static website and Pages Functions. Pages Function requests count against the Workers Free allowance; current Workers Free limits include 100,000 requests/day and 10 ms CPU time per invocation.
- Cloudflare D1 Free currently lists 500 MB per database, 5 GB total account storage, 5 million rows read/day and 100,000 rows written/day. The database has a 2 MB maximum row/string/BLOB size, so uploaded files are split into 512 KiB chunks.
- This app limits each online upload to 12 MB and stops new uploads at about 450 MB total media storage to leave database headroom.
- Resend Free currently lists 3,000 emails/month and 100 emails/day. Do not enable a paid plan or pay-as-you-go for this no-cost setup.
- No Cloudflare R2 bucket, PostgreSQL service, Render service or payment-based storage is used.
- Free-tier quotas and provider terms can change. Monitor usage and confirm account plan labels before launch. Do not add a card or choose a paid upgrade if your requirement is to remain no-card.

## Backups and support

- Export the CMS content JSON regularly. It does not include uploaded binary media.
- Keep original public photographs/PDFs on a separate institutional drive and maintain a separate D1 backup/export.
- Keep the private GitHub repository as the source-code backup.
- The package has been validated locally, but it has not been deployed to your accounts. DNS verification, D1 provisioning, secret entry, first admin setup and real email receipt must be performed in your accounts.
