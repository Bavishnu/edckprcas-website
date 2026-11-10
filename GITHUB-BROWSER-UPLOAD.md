# Upload this project to your private GitHub repository using the browser (no Git installation)

You do not need Git for Windows, Git Bash, Command Prompt Git commands or the git-scm.com download site. GitHub can accept the project through its website, and Cloudflare Pages can connect directly to the private repository.

## Before you begin

1. Download the final EDCKPRCAS online-CMS ZIP.
2. Extract it on your Windows computer.
3. Open the extracted `kpr-corporate-suite` folder.
4. Open your already-created **private** GitHub repository at github.com.
5. If the repository is empty, continue to Upload. If it already contains the earlier static-only Cloudflare package, replace its old project files with this package's files. The new project must be the only active version at the repository root. Remove obsolete `PUBLISH-UPDATES.bat` (the old Git-push helper) and any old `render.yaml` from earlier packages; the online CMS now saves content directly to D1.

## What to upload

Upload the **contents** of `kpr-corporate-suite`, not the ZIP file and not an extra parent folder. The repository root should show items such as:

```text
.gitignore
.env.example
.dev.vars.example
server.js
start.bat
package.json
wrangler.toml
README.md
public/
  index.html
  content-manager/index.html
  admin/index.html
  assets/
  uploads/
functions/
  _lib/cms.js
  api/contact.js
  api/[[path]].js
migrations/
  0001_initial.sql
  0002_seed_initial_content.sql
data/
  site-data.json
scripts/
  build-cloudflare.js
  cloudflare-smoke-test.js
```

**Required new online-CMS files:**

- `functions/_lib/cms.js`
- `functions/api/[[path]].js`
- `functions/api/contact.js`
- `migrations/0001_initial.sql`
- `migrations/0002_seed_initial_content.sql`
- `public/content-manager/index.html`
- `public/admin/index.html`
- updated `public/assets/js/admin.js`
- updated `scripts/build-cloudflare.js`

Do not remove `server.js`, `start.bat`, the public HTML/CSS/JS, `data/site-data.json`, the official logo or other existing approved media. They preserve the original local preview and website properties.

## Do not upload these files/folders

The browser upload page does not apply `.gitignore` automatically. Manually leave these out:

- `.env` (real local secret file)
- `.dev.vars` (real local secret file)
- `data/admin-auth.json` (local administrator hash/salt)
- `data/inquiries.json` (local visitor submissions)
- `dist/` (generated build output; Cloudflare generates it)
- `node_modules/`
- `.wrangler/`
- `NODE_PATH.txt`
- portable `node.exe` or the Node.js tools folder if you have copied a runtime there
- ZIP archives, screenshots, or actual API keys/passwords

The example files `.env.example` and `.dev.vars.example` are safe templates and may be uploaded. Never put a real Resend key, `CMS_SETUP_TOKEN`, `CMS_PASSWORD_PEPPER`, password or mail credential into any repository file.

The final ZIP omits `render.yaml`; do not restore an older Render configuration file from a previous package.

## Upload in GitHub

1. In the private repository, select **Add file → Upload files**.
2. Drag the project folders and files from inside `kpr-corporate-suite` into the upload area. Make sure the `functions`, `migrations`, `public`, `scripts` and `data` folders appear at the repository root level.
3. Include the hidden `.gitignore` file. In Windows File Explorer, enable **View → Show → Hidden items** if needed.
4. Confirm the real secret files listed above are absent.
5. Scroll down to **Commit changes**.
6. Use a message such as `Add EDCKPRCAS online CMS Cloudflare package`.
7. Commit directly to the repository's production branch, normally `main`.

GitHub's browser uploader currently supports up to 100 files at a time and 25 MiB per file. If you have added more than 100 files, upload in multiple batches and keep the directory structure. Large images/PDFs should be compressed below 25 MiB before deployment.

## Connect this private repository to Cloudflare Pages

Once the browser upload is committed:

1. Open Cloudflare Dashboard → Workers & Pages → Create application → Pages → **Connect to Git**.
2. Authorise GitHub and permit access to this private repository.
3. Select the private EDCKPRCAS repository and branch `main`.
4. Use the build settings in `FINAL-DEPLOYMENT-GUIDE.md`.
5. Cloudflare will build and deploy when a new commit is added through GitHub's browser UI. You do not need to install Git locally.

**Project-type decision:** choose Git integration when creating this Pages project. Cloudflare documents that a Git-integrated Pages project cannot later be switched to Direct Upload. Do not select Dashboard drag-and-drop for this site: the Pages Functions in `functions/` are needed for the online CMS and contact form.

## If the repository already has the older static-only project

Replace the old package files with this new project version. In particular, ensure the new `functions/`, `migrations/`, online CMS HTML files and updated build script are present. Delete stale `dist/` output, any old `render.yaml`, and old `PUBLISH-UPDATES.bat` from the repository if they were uploaded previously. Do not keep two versions nested in separate folders; Cloudflare's root directory must be the folder containing `server.js`, `wrangler.toml`, `functions/`, `migrations/`, `public/` and `scripts/`.
