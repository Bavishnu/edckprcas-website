# Changes made — EDCKPRCAS online CMS on Cloudflare Free

## Website preservation

- Preserved the existing EDCKPRCAS public HTML pages, CSS, frontend JavaScript, branding, page copy, logo, supplied media, local Node preview and local Content Manager.
- Did not redesign the visual website or remove the existing public page properties.

## Online Content Manager

- Added the existing Content Manager interface to the Cloudflare Pages build at `/content-manager/` and retained `/admin/` as an alias.
- Added Pages Function APIs for first administrator setup, login/logout, session checks, content read/save, password change, uploads, social previews and Enquiry Inbox management.
- Added Cloudflare D1 migrations for content, administrator credentials, session records, login throttling, enquiries, media file metadata/chunks and enquiry throttling.
- Seeded the existing `data/site-data.json` as initial online content using an insert-if-absent migration.
- Normal production CMS edits save directly to D1 and appear on the public site without a new build or GitHub commit.
- Local `localhost:3000/content-manager/` remains a separate local JSON preview; it does not automatically sync with D1.

## Contact email and enquiry storage

- Contact submissions are validated and saved to the D1 Enquiry Inbox before email delivery is attempted.
- Resend sends valid enquiries to `edc@kprcas.ac.in` using the visitor's submitted email as Reply-To.
- The CMS tracks whether Resend accepted the email and records the provider error when delivery is unsuccessful.
- The visitor does not receive an automatic acknowledgement email in this release.
- No actual mail credentials or sender-domain authorisation are included; the user/IT administrator must configure these after deployment.

## Free-hosting architecture

- Cloudflare Pages Free serves the website and Pages Functions.
- Cloudflare D1 Free stores online content, administrator/session records, enquiries and uploaded media.
- Media is stored in 512 KiB chunks in D1; no R2 bucket is used.
- Per-file CMS upload limit is 12 MB; the app stops new uploads at approximately 450 MB total media storage to leave headroom under D1 Free limits.
- Resend Free is used for transactional contact notifications.
- Cloudflare Pages must be created with Git integration because the app needs Pages Functions. The user may upload/commit files through the GitHub website; Git CLI is not required.

## Security and operations

- Admin passwords use PBKDF2-SHA256 with per-account random salt and a permanent server-side `CMS_PASSWORD_PEPPER` Cloudflare Secret. The iteration count is kept modest to respect Workers Free CPU limits; use a strong, unique 16+ character passphrase.
- `CMS_SETUP_TOKEN` is a temporary secret used to create the first online administrator and must be removed after setup.
- Admin sessions use Secure, HttpOnly, SameSite=Lax cookies and expire after eight hours of inactivity.
- Login attempts and contact submissions are rate-limited by hashed client IPs.
- API routes are restricted to `/api/*`; public static assets do not invoke Pages Functions.

## Intentional limits

- Online media files are public website media, not private document storage.
- The online CMS upload limit is 12 MB per file and approximately 450 MB total media data.
- The CMS export file contains content JSON and paths but not media binaries. Keep original media separately and back up D1.
- A full media-library delete interface is not included; unused media removal requires a controlled maintenance step.
- The contact form does not send visitor acknowledgement emails.
- Free plan quotas can change and must be monitored.
