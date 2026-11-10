import {
  json, readJson, sameOrigin, sha256Hex, createSession, getSession,
  requireAdmin, verifyPassword, makePasswordRecord, safeFilename, constantTimeEqual,
  saveMedia, readMedia, cookieClear
} from "../_lib/cms.js";

const MAX_CONTENT_BYTES = 1_800_000;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_MEDIA_STORAGE_BYTES = 450 * 1024 * 1024;
const EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf"
};
const SOCIAL_HOSTS = [
  "youtube.com", "youtu.be", "youtube-nocookie.com", "instagram.com", "linkedin.com",
  "lnkd.in", "facebook.com", "fb.watch", "tiktok.com", "x.com", "twitter.com"
];

function hostMatches(host, domain) { return host === domain || host.endsWith(`.${domain}`); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim()); }
function randomId() { return crypto.randomUUID(); }

async function rateLimitStatus(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipHash = await sha256Hex(ip);
  const row = await env.DB.prepare("SELECT attempts, locked_until FROM cms_login_attempts WHERE ip_hash = ?")
    .bind(ipHash).first();
  if (row && Number(row.locked_until) > Date.now()) {
    return { ipHash, blocked: true, retryAfter: Math.ceil((Number(row.locked_until) - Date.now()) / 1000) };
  }
  return { ipHash, blocked: false, row };
}

async function recordLoginFailure(env, state) {
  const attempts = Number(state.row?.attempts || 0) + 1;
  const lockedUntil = attempts >= 8 ? Date.now() + 5 * 60 * 1000 : 0;
  await env.DB.prepare(
    "INSERT INTO cms_login_attempts (ip_hash, attempts, locked_until, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(ip_hash) DO UPDATE SET attempts = excluded.attempts, locked_until = excluded.locked_until, updated_at = excluded.updated_at"
  ).bind(state.ipHash, lockedUntil ? 0 : attempts, lockedUntil, new Date().toISOString()).run();
}

async function setupAdmin(request, env) {
  if (!sameOrigin(request)) return json({ error: "This action must come from the EDCKPRCAS website." }, 403);
  const existing = await env.DB.prepare("SELECT id FROM cms_admin WHERE id = 1").first();
  if (existing) return json({ error: "A Content Manager account already exists. Please sign in." }, 409);
  const setupKey = String(env.CMS_SETUP_TOKEN || "");
  if (!setupKey) return json({ error: "The first-time CMS setup key has not been configured in Cloudflare yet." }, 503);
  const pepper = String(env.CMS_PASSWORD_PEPPER || "");
  if (pepper.length < 32) return json({ error: "The permanent CMS_PASSWORD_PEPPER secret is missing or too short. Configure a random value of at least 32 characters in Cloudflare." }, 503);
  const body = await readJson(request, 16 * 1024);
  if (!body.setupToken || !constantTimeEqual(String(body.setupToken), setupKey)) return json({ error: "The one-time setup key is incorrect." }, 403);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) return json({ error: "Username must be 3–32 characters and use letters, numbers, dots, dashes or underscores." }, 400);
  if (password.length < 10) return json({ error: "Use a password with at least 10 characters." }, 400);
  const secured = await makePasswordRecord(password, pepper);
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      "INSERT INTO cms_admin (id, username, password_salt, password_hash, password_iterations, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?)"
    ).bind(username, secured.password_salt, secured.password_hash, secured.password_iterations, now, now).run();
  } catch {
    return json({ error: "The administrator account was created by another setup request. Please sign in." }, 409);
  }
  const session = await createSession(env, username);
  return json({ ok: true, username }, 201, { "set-cookie": session.cookie });
}

async function loginAdmin(request, env) {
  if (!sameOrigin(request)) return json({ error: "This action must come from the EDCKPRCAS website." }, 403);
  const limit = await rateLimitStatus(request, env);
  if (limit.blocked) return json({ error: "Too many attempts. Please wait a few minutes and try again." }, 429, { "retry-after": String(limit.retryAfter) });
  const body = await readJson(request, 16 * 1024);
  const record = await env.DB.prepare("SELECT username, password_salt, password_hash, password_iterations FROM cms_admin WHERE id = 1").first();
  if (!record) return json({ error: "Create the first Content Manager account before signing in." }, 409);
  const pepper = String(env.CMS_PASSWORD_PEPPER || "");
  if (pepper.length < 32) return json({ error: "The permanent CMS_PASSWORD_PEPPER secret is not configured correctly in Cloudflare." }, 503);
  const valid = String(body.username || "") === record.username && await verifyPassword(String(body.password || ""), record, pepper);
  if (!valid) {
    await recordLoginFailure(env, limit);
    return json({ error: "The username or password is incorrect." }, 401);
  }
  await env.DB.prepare("DELETE FROM cms_login_attempts WHERE ip_hash = ?").bind(limit.ipHash).run();
  const session = await createSession(env, record.username);
  return json({ ok: true, username: record.username }, 200, { "set-cookie": session.cookie });
}

async function logoutAdmin(request, env) {
  if (!sameOrigin(request)) return json({ error: "This action must come from the EDCKPRCAS website." }, 403);
  const session = await getSession(request, env);
  if (session) await env.DB.prepare("DELETE FROM cms_sessions WHERE token_hash = ?").bind(session.tokenHash).run();
  return json({ ok: true }, 200, { "set-cookie": cookieClear() });
}

async function changePassword(request, env, session) {
  const body = await readJson(request, 16 * 1024);
  const record = await env.DB.prepare("SELECT username, password_salt, password_hash, password_iterations FROM cms_admin WHERE id = 1").first();
  if (!record || !await verifyPassword(String(body.currentPassword || ""), record, env.CMS_PASSWORD_PEPPER)) return json({ error: "Current password is not correct." }, 401);
  const next = String(body.newPassword || "");
  if (next.length < 10) return json({ error: "New password must have at least 10 characters." }, 400);
  const secured = await makePasswordRecord(next, env.CMS_PASSWORD_PEPPER);
  await env.DB.prepare("UPDATE cms_admin SET password_salt = ?, password_hash = ?, password_iterations = ?, updated_at = ? WHERE id = 1")
    .bind(secured.password_salt, secured.password_hash, secured.password_iterations, new Date().toISOString()).run();
  // Invalidate all other sessions, retaining the current browser session.
  await env.DB.prepare("DELETE FROM cms_sessions WHERE token_hash <> ?").bind(session.tokenHash).run();
  return json({ ok: true });
}

async function uploadMedia(request, env) {
  const contentType = String(request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const extension = EXTENSIONS[contentType];
  if (!extension) return json({ error: "Upload a JPG, PNG, WEBP, GIF or PDF file." }, 415);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_UPLOAD_BYTES) return json({ error: "The file is larger than 12 MB." }, 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.byteLength) return json({ error: "The selected file is empty." }, 400);
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return json({ error: "The file is larger than 12 MB." }, 413);
  const total = await env.DB.prepare("SELECT COALESCE(SUM(file_size), 0) AS total_size FROM cms_media_files").first();
  if (Number(total?.total_size || 0) + bytes.byteLength > MAX_MEDIA_STORAGE_BYTES) {
    return json({ error: "The online media storage is approaching the free database limit. Compress or remove unused media before uploading more files." }, 507);
  }
  const url = new URL(request.url);
  const originalName = url.searchParams.get("filename") || `upload${extension}`;
  const filename = safeFilename(originalName, extension);
  await saveMedia(env, filename, contentType, bytes);
  return json({ ok: true, url: `/api/media/${filename}`, filename }, 201);
}

async function serveMedia(filename, env) {
  if (!/^[a-zA-Z0-9._-]{1,180}$/.test(filename) || filename.includes("..")) return new Response("Not found", { status: 404 });
  const media = await readMedia(env, filename);
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(media.bytes, {
    status: 200,
    headers: {
      "content-type": media.mimeType,
      "content-length": String(media.fileSize),
      "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff",
      "content-disposition": `inline; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`
    }
  });
}

function decodeHtml(value) {
  return String(value || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function metaValue(html, wanted) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const attr = name => (tag.match(new RegExp(`\\b${name}\\s*=\\s*([\"'])(.*?)\\1`, "i")) || [])[2] || "";
    const key = (attr("property") || attr("name") || "").toLowerCase();
    if (key === wanted.toLowerCase()) return decodeHtml(attr("content"));
  }
  return "";
}
function youtubeId(url) {
  if (url.hostname.includes("youtu.be")) return url.pathname.split("/").filter(Boolean)[0] || "";
  if (url.hostname.includes("youtube.com")) return url.searchParams.get("v") || (url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/) || [])[1] || "";
  return "";
}

async function socialPreview(request) {
  const body = await readJson(request, 16 * 1024);
  const raw = String(body.url || "").trim();
  if (!raw) return json({ error: "Paste a public social media post or video URL first." }, 400);
  let target;
  try { target = new URL(raw); } catch { return json({ error: "Enter a valid public social media URL." }, 400); }
  if (target.protocol !== "https:" || target.username || target.password || !SOCIAL_HOSTS.some(domain => hostMatches(target.hostname.toLowerCase(), domain))) {
    return json({ error: "Use a public HTTPS YouTube, Instagram, LinkedIn, Facebook, TikTok or X URL." }, 400);
  }
  const id = youtubeId(target);
  if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) {
    return json({ ok: true, url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, filename: "YouTube thumbnail", title: "YouTube video" }, 201);
  }
  let response;
  try { response = await fetch(target.toString(), { headers: { "user-agent": "Mozilla/5.0 (compatible; EDCKPRCAS-CMS/1.0)", accept: "text/html,application/xhtml+xml" }, redirect: "manual" }); }
  catch { return json({ error: "The social platform could not be reached. Upload the image manually instead." }, 422); }
  if (!response.ok || !["text/html", "application/xhtml+xml"].some(type => (response.headers.get("content-type") || "").toLowerCase().includes(type))) {
    return json({ error: "The platform did not provide a public thumbnail. Upload the image manually instead." }, 422);
  }
  const text = await response.text();
  if (text.length > 1_000_000) return json({ error: "The platform preview is too large. Upload the image manually instead." }, 422);
  let image = metaValue(text, "og:image") || metaValue(text, "twitter:image") || metaValue(text, "twitter:image:src");
  if (!image) return json({ error: "This platform does not expose a public thumbnail. Upload the image manually instead." }, 422);
  try { image = new URL(image, target).toString(); } catch { return json({ error: "The platform returned an invalid preview image. Upload it manually instead." }, 422); }
  if (!image.startsWith("https://")) return json({ error: "Only HTTPS preview images are supported." }, 422);
  return json({ ok: true, url: image, filename: "Social media thumbnail", title: metaValue(text, "og:title") || metaValue(text, "twitter:title") || "Social media post" }, 201);
}

async function publicContent(env, request) {
  const row = await env.DB.prepare("SELECT content_json, updated_at FROM cms_content WHERE id = 1").first();
  if (!row) return json({ error: "Website content has not been initialized. Run the initial D1 seed step." }, 503);
  let content;
  try { content = JSON.parse(row.content_json); }
  catch { return json({ error: "The stored website content is invalid. Restore a valid CMS backup." }, 500); }
  if (content.site && request?.url) content.site.website = new URL(request.url).origin;
  return json(content, 200, { "last-modified": row.updated_at || "" });
}

async function updateContent(request, env) {
  const body = await readJson(request, MAX_CONTENT_BYTES);
  if (!body || typeof body !== "object" || Array.isArray(body) || !body.site || typeof body.site !== "object") {
    return json({ error: "The content structure is not valid." }, 400);
  }
  // Keep canonical URLs aligned with the active Pages custom domain.
  body.site.website = new URL(request.url).origin;
  const contentJson = JSON.stringify(body);
  if (new TextEncoder().encode(contentJson).byteLength > MAX_CONTENT_BYTES) {
    return json({ error: "The website content is too large for the free online content record. Remove unused text or move older content to an archive." }, 413);
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO cms_content (id, content_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET content_json = excluded.content_json, updated_at = excluded.updated_at"
  ).bind(contentJson, now).run();
  return json({ ok: true, savedAt: now });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: "The EDCKPRCAS D1 database binding is missing. Configure the DB binding in Cloudflare Pages settings and redeploy." }, 503);
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  try {
    if (path === "/api/health" && method === "GET") {
      await env.DB.prepare("SELECT 1 AS ok").first();
      return json({ ok: true, name: "EDCKPRCAS Online Content Manager", storage: "Cloudflare D1" });
    }
    if (path === "/api/content" && method === "GET") return publicContent(env, request);
    if (path === "/api/auth/status" && method === "GET") {
      const admin = await env.DB.prepare("SELECT username FROM cms_admin WHERE id = 1").first();
      const session = admin ? await getSession(request, env) : null;
      return json({ setupRequired: !admin, authenticated: Boolean(session) });
    }
    if (path === "/api/admin/setup" && method === "POST") return setupAdmin(request, env);
    if (path === "/api/admin/login" && method === "POST") return loginAdmin(request, env);
    if (path === "/api/admin/logout" && method === "POST") return logoutAdmin(request, env);

    const mediaMatch = path.match(/^\/api\/media\/([^/]+)$/);
    if (mediaMatch && method === "GET") return serveMedia(decodeURIComponent(mediaMatch[1]), env);

    const auth = await requireAdmin(request, env);
    if (auth.error) return auth.error;
    const { session } = auth;

    if (path === "/api/admin/whoami" && method === "GET") return json({ username: session.username });
    if (path === "/api/admin/data" && method === "GET") return publicContent(env, request);
    if (path === "/api/admin/data" && method === "PUT") return updateContent(request, env);
    if (path === "/api/admin/password" && method === "POST") return changePassword(request, env, session);
    if (path === "/api/admin/upload" && method === "POST") return uploadMedia(request, env);
    if (path === "/api/admin/social-preview" && method === "POST") return socialPreview(request);

    if (path === "/api/admin/inquiries" && method === "GET") {
      const result = await env.DB.prepare(
        "SELECT id, name, email, subject, message, received_at AS receivedAt, status, email_sent AS emailSent, email_error AS emailError FROM cms_inquiries ORDER BY received_at DESC LIMIT 1000"
      ).all();
      return json((result.results || []).map(item => ({ ...item, emailSent: Boolean(item.emailSent) })));
    }
    const inquiryMatch = path.match(/^\/api\/admin\/inquiries\/([a-f0-9-]+)$/i);
    if (inquiryMatch && method === "PATCH") {
      const body = await readJson(request, 8 * 1024);
      const status = String(body.status || "").trim();
      if (!["New", "In progress", "Resolved"].includes(status)) return json({ error: "Choose a valid enquiry status." }, 400);
      const result = await env.DB.prepare("UPDATE cms_inquiries SET status = ? WHERE id = ?")
        .bind(status, inquiryMatch[1]).run();
      if (!result.meta?.changes) return json({ error: "Enquiry not found." }, 404);
      return json({ ok: true });
    }

    return json({ error: "API route not found." }, 404);
  } catch (error) {
    console.error("EDCKPRCAS CMS API error", error?.message || error);
    return json({ error: error?.message || "Unexpected server error." }, 500);
  }
}
