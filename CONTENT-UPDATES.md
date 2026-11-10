# How to update the live EDCKPRCAS website after deployment

## Use the online Content Manager for normal updates

After the Cloudflare D1 setup is complete, use the hosted dashboard:

`https://YOUR-PAGES-HOSTNAME.pages.dev/content-manager/`

Replace `YOUR-PAGES-HOSTNAME` with the exact Pages hostname assigned to your project. After the official domain is connected, use:

`https://edckprcas.co.in/content-manager/`

(or the approved EDC subdomain if the domain owner only grants CNAME access).

### Everyday update steps

1. Open the hosted `/content-manager/` address in your browser.
2. Sign in with the online Content Manager username and password created during first-time setup.
3. Choose the relevant section: Site identity, Home, About, People, Events, Startups, Impact, Messages, Gallery, Blogs, Social media, Mentors, Annual reports, Opportunities, Achievements or Page introductions.
4. Add or edit the record/text.
5. Use the upload control for approved JPG, PNG, WEBP, GIF or PDF media (maximum 12 MB per file).
6. Save the section or record.
7. Open the public website in another tab and refresh. The Pages Function reads the latest content from D1, so ordinary content changes do not require GitHub, a new build or a redeployment.
8. Open Content Manager → Enquiry inbox to review messages. Each enquiry shows whether Resend accepted its email notification and any recorded delivery error.

## Important: local CMS and online CMS are separate

- `http://localhost:3000/content-manager/` is the local Node.js preview. It saves to JSON files on your computer.
- `https://YOUR-PAGES-HOSTNAME.pages.dev/content-manager/` is the production CMS. It saves to Cloudflare D1 and updates the public site.
- Changes made in the local CMS do not automatically sync to the online CMS. Use the online CMS for everyday live updates.
- Normal production content changes are saved directly to D1. No GitHub commit, local publish script or new deployment is needed.
- Source-code/design changes (HTML, CSS, JavaScript, Pages Functions or SQL migrations) are different. Those require updating the private GitHub repository through the GitHub website and allowing Cloudflare Pages to build again.

## Content and media limits

- Supported upload types: JPG, PNG, WEBP, GIF and PDF.
- Maximum per upload: 12 MB.
- Online media is stored in D1 as 512 KiB chunks; this package does not use R2.
- The application stops accepting new media when stored media reaches approximately 450 MB, leaving some room under the D1 Free database limit.
- Keep approved images compressed and retain original photographs/PDFs in a separate institutional archive.
- Uploaded media is publicly retrievable because it is used by public pages. Do not upload private student records, personal documents or confidential files.
- The current CMS does not yet include a media-library delete screen. Replacing/removing a media reference from a content record does not necessarily remove the old binary from D1. Ask the technical maintainer to remove unused media safely rather than running ad-hoc DELETE statements.

## Backups

1. In the online CMS, use **Export backup** regularly. It exports the website content JSON.
2. The JSON backup includes media paths, not the image/PDF binary data. Keep the original files separately on an institutional drive.
3. Also export or back up the Cloudflare D1 database using the D1 dashboard's available export/backup facilities. The D1 database contains the online administrator, sessions, content, enquiries and uploaded media.
4. Keep `CMS_PASSWORD_PEPPER` securely backed up. It must remain unchanged for the existing administrator password to work.
5. Keep the GitHub repository private and do not upload real secrets or visitor enquiry exports.

## Updating the official domain

When `edckprcas.co.in` or an approved subdomain is connected, the CMS is available on that same hostname at `/content-manager/`. Follow `FINAL-DEPLOYMENT-GUIDE.md` to update the Pages build URLs and `ALLOWED_ORIGINS`, then retest sign-in, content saving, media uploads and the contact form.
