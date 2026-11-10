# EDCKPRCAS GitHub Browser Upload — Start Here

This folder is the GitHub-upload copy of the EDCKPRCAS online-CMS Cloudflare project.

## Upload instructions

1. Open your already-created private GitHub repository.
2. Choose **Add file → Upload files**.
3. Open this folder and upload its **contents** directly into the repository root.
4. Preserve the directory structure. In particular, `functions/`, `migrations/`, `public/`, `scripts/` and `data/` must be at the repository root.
5. Make sure the hidden files `.gitignore`, `.env.example` and `.dev.vars.example` are included.
6. Click **Commit changes** on the `main` branch.

Do not upload this folder as an extra nested folder, and do not upload the ZIP file itself.

## Local-only files intentionally excluded from this upload copy

- `start.bat`, `start.sh`: launch the local Node.js preview server.
- `OPEN-ONLINE-CMS.bat`: convenience shortcut to open the hosted CMS in a browser.
- `PORTABLE-NODE-SETUP.txt`: instructions for using a portable local Node.js installation.
- `tools/`: this ZIP only contained placeholders/documentation there; no runtime was included.

No bundled `node.exe`, `npm.cmd` or portable Node.js runtime was present in the source ZIP.

The original ZIP remains the full project backup. This upload copy does not alter website HTML, CSS, public JavaScript, Cloudflare Functions, D1 migrations, seed content, uploaded logo/media, or the Node.js local server source.

## Never upload private/generated files

Do not upload:
- `.env` or `.dev.vars` (the example templates are safe and should be kept);
- actual API keys, SMTP passwords, or Cloudflare secrets;
- `data/admin-auth.json`, `data/inquiries.json`, `NODE_PATH.txt`;
- `node_modules/`, `.wrangler/`, `dist/`, local ZIP backups, or a portable `node.exe`.

## Keep these files

Keep `.gitignore`, `.env.example`, `.dev.vars.example`, `package.json`, `wrangler.toml`, `data/site-data.json`, `server.js`, `functions/`, `migrations/`, `public/`, and `scripts/`.

After the GitHub upload, connect the repository to Cloudflare Pages using the deployment settings in `FINAL-DEPLOYMENT-GUIDE.md`. The website requires the Cloudflare Pages Functions and D1 binding named `DB`; do not use static drag-and-drop hosting.
