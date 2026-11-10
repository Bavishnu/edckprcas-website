# Deployment architecture and guides

This package uses Cloudflare Pages Free + Cloudflare Pages Functions + Cloudflare D1 Free for the **online Content Manager**, with Resend Free for contact-form email.

Use these instructions in order:

1. `GITHUB-BROWSER-UPLOAD.md` — upload the source package into your existing private GitHub repository through the browser. Git CLI is not required.
2. `FINAL-DEPLOYMENT-GUIDE.md` — connect the repository to Cloudflare Pages, publish the free `pages.dev` address, and connect the official domain later.
3. `ONLINE-CMS-SETUP.md` — create and seed D1, add the exact `DB` binding, set CMS secrets and create the first hosted administrator.
4. `EMAIL-SETUP-FOR-BEGINNERS.md` — verify an authorised sender domain in Resend, configure Cloudflare variables/secrets and test mail delivery to `edc@kprcas.ac.in`.
5. `CONTENT-UPDATES.md` — use the online Content Manager for ongoing text, records and media updates.
6. `CLOUDFLARE-CHECKLIST.md` — final go-live checklist.

No R2 bucket, PostgreSQL service or Render service is required. The online CMS uses D1. No provider credentials are bundled in this source package.
