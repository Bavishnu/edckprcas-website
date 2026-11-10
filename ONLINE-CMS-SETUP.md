# Online Content Manager — first-time Cloudflare D1 setup

This guide turns the included Content Manager into an online dashboard. After setup, you can open it from any device at:

`https://YOUR-PAGES-HOSTNAME.pages.dev/content-manager/`

The online CMS saves to Cloudflare D1, not your laptop. D1 is required for persistent online content, accounts, enquiries and media. This is the Cloudflare Free database option in this package; no R2 bucket is used.

## What must be ready first

- The project is in your private GitHub repository (browser upload is fine; no Git CLI needed).
- Cloudflare Pages has completed its first build.
- You know the exact Pages hostname assigned by Cloudflare, for example `edckprcas-website.pages.dev`.

The site can display its bundled starter content before D1 is configured, but online CMS login, editing, uploads and online enquiry storage are not operational until D1 is created, seeded and bound.

## Step 1 — Create a D1 database

1. Sign in to Cloudflare Dashboard.
2. Open **D1** (Cloudflare may place it under Workers & Pages or Storage & Databases).
3. Select **Create database**.
4. Database name: `edckprcas-online-cms`.
5. Select the Free option if a plan selector appears. Do not choose a paid upgrade or R2.
6. Create the database and open its **Console**.

## Step 2 — Create the tables

The project ZIP includes two SQL migration files. Run them in this exact order in the D1 Console.

1. Open `migrations/0001_initial.sql` from your extracted project in Notepad or VS Code.
2. Copy the entire file and paste it into the D1 Console.
3. Run the SQL and confirm it finishes without an error.
4. Open `migrations/0002_seed_initial_content.sql`.
5. Copy the entire file and paste it into the D1 Console.
6. Run it once. This inserts the starting `data/site-data.json` content into the online CMS without overwriting later edits if the seed is run again.

Verify the seed by running:

```sql
SELECT COUNT(*) AS content_records FROM cms_content;
```

The result should be `1`.

The first migration creates the tables for website content, administrator credentials, sessions, login throttling, enquiries and media. It also creates the contact-form rate-limit table.

## Step 3 — Bind the database to Pages

1. Open Cloudflare → Workers & Pages → your EDCKPRCAS Pages project.
2. Open **Settings → Bindings**.
3. Select **Add** → **D1 database binding**.
4. Variable name: `DB` (uppercase, exactly).
5. D1 database: select `edckprcas-online-cms`.
6. Save.
7. Redeploy the latest production deployment so the Function receives the new binding.

The code uses `context.env.DB`. A different binding name will not work.

## Step 4 — Generate the two CMS secrets on your computer

Open Command Prompt in a folder with Node.js installed. Run this command **twice**, separately:

```bat
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The first generated 64-character value is your **CMS_SETUP_TOKEN**. The second generated 64-character value is your **CMS_PASSWORD_PEPPER**.

Store both in a password manager or another secure private record. Do not put them in GitHub, `.env.example`, screenshots or messages.

- `CMS_SETUP_TOKEN` is temporary. It allows creation of the first administrator only. Remove it after the account is created.
- `CMS_PASSWORD_PEPPER` is permanent. The online administrator's password hash uses it. Keep it unchanged and retain a secure backup. If you lose it, your current admin password cannot be verified; you will need to reset the admin record in D1 and create a new account.

## Step 5 — Add Pages Function variables and Secrets

In Cloudflare → Workers & Pages → your Pages project → **Settings → Variables and Secrets**, choose the **Production** environment. The exact dashboard wording can vary.

Add these values:

| Name | Type | Value |
|---|---|---|
| `CMS_SETUP_TOKEN` | Secret | First 64-character value generated above |
| `CMS_PASSWORD_PEPPER` | Secret | Second 64-character value generated above |
| `ALLOWED_ORIGINS` | Plain variable | `https://YOUR-PAGES-HOSTNAME.pages.dev` |

Use the exact hostname shown by Cloudflare. Do not include a trailing slash in `ALLOWED_ORIGINS`.

You can add Resend variables later using `EMAIL-SETUP-FOR-BEGINNERS.md`. For a fully configured mail service, add `RESEND_API_KEY` as a Secret plus `MAIL_FROM` and `MAIL_TO` as plain variables.

Save the settings and redeploy.

## Step 6 — Check the online API before creating an account

Open these URLs using your actual Pages hostname:

- `https://YOUR-PAGES-HOSTNAME.pages.dev/api/health`
- `https://YOUR-PAGES-HOSTNAME.pages.dev/api/auth/status`

Expected:

- `/api/health` returns JSON indicating `ok: true` and `Cloudflare D1` storage.
- `/api/auth/status` returns `setupRequired: true` before you create the first account.

If `/api/health` says the D1 binding is missing, check Settings → Bindings and verify the variable name is exactly `DB`, then redeploy. If the seed is missing, run migration `0002_seed_initial_content.sql` in D1 Console.

## Step 7 — Create the first online administrator

1. Open `https://YOUR-PAGES-HOSTNAME.pages.dev/content-manager/`.
2. The first-time setup page appears.
3. Username: choose a unique username (3–32 letters/numbers/dot/dash/underscore).
4. Password: use a unique passphrase of at least 12–16 characters (the form minimum is 10).
5. Confirm the password.
6. Paste the first generated value (`CMS_SETUP_TOKEN`) into **One-time setup key**.
7. Select **Create Content Manager**.
8. The dashboard should open after account creation.

Immediately return to Cloudflare → Settings → Variables and Secrets and delete **only** `CMS_SETUP_TOKEN`. Keep `CMS_PASSWORD_PEPPER` permanently. Redeploy after changing the secret so the production environment is consistent.

Your online admin URL is now:

`https://YOUR-PAGES-HOSTNAME.pages.dev/content-manager/`

The `/admin/` route also opens the same interface.

## Step 8 — Confirm the CMS is online

Inside the hosted dashboard:

1. Check the Dashboard screen shows Cloudflare D1/online storage.
2. Open Site identity and make a harmless test text change; save it.
3. Open the public homepage in another tab and refresh. The update should appear without a new build or GitHub commit.
4. Add a test event or blog draft, save, then remove the test record.
5. Upload a small test JPG; confirm it appears on the page or in the record preview.
6. Open Enquiry inbox; it should load from D1.
7. Open Account security and change the temporary administrator password if desired.

The website's public `site.js` fetches the live content API. Static `data/site-data.json` is only a fallback snapshot if the API is unavailable; once D1 is working, the online API is the live source of truth.

## Online media limits

- Image/PDF formats: JPG, PNG, WEBP, GIF and PDF.
- Maximum individual CMS upload: 12 MB.
- Media is stored in D1 in 512 KiB chunks (no R2).
- Application upload cap: 450 MB total to leave headroom under D1's 500 MB per-database Free limit.
- Keep images compressed and store original photographs/PDFs in an institutional archive.
- D1 limits a single row/string/BLOB to 2,000,000 bytes; chunking keeps each media chunk below that ceiling.

Cloudflare D1 Free currently lists 500 MB per database, 5 GB per account, 5 million rows read/day and 100,000 rows written/day. Function requests also consume the Workers Free request quota. Check Cloudflare's current quotas before the launch and monitor usage.

## Password, account and storage recovery

- **Forgot password:** in D1 Console, run `DELETE FROM cms_sessions;` and `DELETE FROM cms_admin WHERE id = 1;`. Temporarily re-add a fresh `CMS_SETUP_TOKEN` Secret, open `/content-manager/`, create the administrator again using the existing `CMS_PASSWORD_PEPPER`, and remove `CMS_SETUP_TOKEN` after success. Do not delete `cms_content`, `cms_inquiries` or media tables.
- **Do not lose the pepper:** `CMS_PASSWORD_PEPPER` must remain the same while the existing administrator record is in D1.
- **Storage nearly full:** export a content JSON backup, archive source files, remove unused large media (requires an explicit media deletion workflow or database cleanup), and stay below 450 MB. Do not delete D1 tables to solve storage.
- **D1 daily quota reached:** queries will fail until the quota resets; check Cloudflare D1 usage/analytics and reduce excessive polling or automated activity.

## Important distinction: local and online CMS

`http://localhost:3000/content-manager/` is the local Node.js preview and has its own local JSON store. It does not automatically connect to or sync with the Cloudflare D1 account. For production editing, use the hosted `/content-manager/` URL. Use Export/Import only when intentionally transferring JSON content between the two environments; re-upload media separately if it is not already in the online database.
