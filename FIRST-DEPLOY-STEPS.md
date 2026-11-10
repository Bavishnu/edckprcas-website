# First deployment — recommended order

1. **Source backup:** Upload the contents of this project folder to your existing private GitHub repository using the browser. Git for Windows and Git CLI are not required. Follow `GITHUB-BROWSER-UPLOAD.md`.
2. **Free hosting:** Create a Cloudflare Pages project using **Connect to Git**, select your private repository, and use build command `node scripts/build-cloudflare.js` with output `dist`. Follow `FINAL-DEPLOYMENT-GUIDE.md`.
3. **Online CMS:** Create the free D1 database, run both SQL migrations, bind it as `DB`, set the two CMS Secrets, and create your hosted administrator at `/content-manager/`. Follow `ONLINE-CMS-SETUP.md`.
4. **Email receiving:** Verify a sender domain in Resend, add the API key as a Cloudflare Secret, configure `MAIL_FROM`, `MAIL_TO` and `ALLOWED_ORIGINS`, then test a real enquiry. Follow `EMAIL-SETUP-FOR-BEGINNERS.md`.
5. **Official domain:** When your friend grants DNS permission, add `edckprcas.co.in` if nameserver access is approved, or preferably `edc.edckprcas.co.in` if only a CNAME can be added. Follow the domain section in `FINAL-DEPLOYMENT-GUIDE.md`.
6. **Everyday content:** Use the online `/content-manager/` dashboard. Normal content edits are saved to D1 immediately and do not require GitHub or redeployment. Follow `CONTENT-UPDATES.md`.

Do not announce the contact form as operational until a real test email arrives at `edc@kprcas.ac.in`.
