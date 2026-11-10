const encoder = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers
    }
  });
}

export async function readJson(request, maxBytes = 2 * 1024 * 1024) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw new Error("The request is too large.");
  const raw = await request.text();
  if (encoder.encode(raw).byteLength > maxBytes) throw new Error("The request is too large.");
  try { return JSON.parse(raw || "{}"); }
  catch { throw new Error("Please provide valid JSON."); }
}

export function cookieValue(request, name) {
  const header = request.headers.get("cookie") || "";
  const item = header.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  if (!item) return "";
  try { return decodeURIComponent(item.slice(name.length + 1)); }
  catch { return ""; }
}

export function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

export async function sha256Hex(value) {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function randomHex(length = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left, right) {
  const a = encoder.encode(String(left || ""));
  const b = encoder.encode(String(right || ""));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

async function passwordHash(password, saltHex, pepper, iterations = 20000) {
  const salt = new Uint8Array((saltHex.match(/.{2}/g) || []).map(value => parseInt(value, 16)));
  // A server-side pepper is kept separately as a Cloudflare Secret, never in D1.
  const material = `${String(pepper || "")}\u0000${String(password || "")}`;
  const key = await crypto.subtle.importKey("raw", encoder.encode(material), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function createSession(env, username) {
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const expires = now + (8 * 60 * 60 * 1000);
  await env.DB.prepare(
    "INSERT INTO cms_sessions (token_hash, username, created_at, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(tokenHash, username, new Date(now).toISOString(), expires).run();
  return {
    token,
    cookie: `kpr_sid=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=28800`
  };
}

export async function getSession(request, env) {
  const token = cookieValue(request, "kpr_sid");
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const row = await env.DB.prepare(
    "SELECT s.username, s.expires_at FROM cms_sessions s INNER JOIN cms_admin a ON a.id = 1 WHERE s.token_hash = ? AND s.expires_at > ?"
  ).bind(tokenHash, now).first();
  if (!row) {
    await env.DB.prepare("DELETE FROM cms_sessions WHERE token_hash = ? OR expires_at <= ?")
      .bind(tokenHash, now).run();
    return null;
  }
  const refreshedExpiry = now + (8 * 60 * 60 * 1000);
  await env.DB.prepare("UPDATE cms_sessions SET expires_at = ? WHERE token_hash = ?")
    .bind(refreshedExpiry, tokenHash).run();
  return { username: row.username, tokenHash };
}

export async function requireAdmin(request, env) {
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase()) && !sameOrigin(request)) return { error: json({ error: "This action must come from the EDCKPRCAS website." }, 403) };
  const session = await getSession(request, env);
  if (!session) return { error: json({ error: "Please sign in to the Content Manager." }, 401) };
  return { session };
}

export async function verifyPassword(password, record, pepper) {
  if (!record?.password_salt || !record?.password_hash || !pepper) return false;
  const candidate = await passwordHash(String(password || ""), record.password_salt, pepper, Number(record.password_iterations) || 20000);
  return constantTimeEqual(candidate, record.password_hash);
}

export async function makePasswordRecord(password, pepper) {
  const salt = randomHex(16);
  return {
    password_salt: salt,
    password_hash: await passwordHash(String(password), salt, pepper),
    password_iterations: 20000
  };
}

export function safeFilename(original, ext) {
  const base = String(original || "upload").replace(/\\/g, "/").split("/").pop().replace(/\.[^.]*$/, "")
    .normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "upload";
  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${base}${ext}`;
}

export async function saveMedia(env, filename, mimeType, bytes) {
  const chunkSize = 512 * 1024;
  const chunkCount = Math.ceil(bytes.byteLength / chunkSize);
  const statements = [env.DB.prepare(
    "INSERT INTO cms_media_files (filename, mime_type, file_size, chunk_count, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(filename, mimeType, bytes.byteLength, chunkCount, new Date().toISOString())];
  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = bytes.slice(index * chunkSize, Math.min((index + 1) * chunkSize, bytes.byteLength));
    statements.push(env.DB.prepare(
      "INSERT INTO cms_media_chunks (filename, chunk_index, data) VALUES (?, ?, ?)"
    ).bind(filename, index, chunk));
  }
  await env.DB.batch(statements);
}

export async function readMedia(env, filename) {
  const result = await env.DB.prepare(
    "SELECT f.mime_type, f.file_size, c.chunk_index, c.data FROM cms_media_files f INNER JOIN cms_media_chunks c ON c.filename = f.filename WHERE f.filename = ? ORDER BY c.chunk_index"
  ).bind(filename).all();
  const rows = result.results || [];
  if (!rows.length) return null;
  const fileSize = Number(rows[0].file_size);
  const mimeType = rows[0].mime_type;
  const output = new Uint8Array(fileSize);
  let offset = 0;
  for (const row of rows) {
    const chunk = row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : new Uint8Array(row.data.buffer || row.data, row.data.byteOffset || 0, row.data.byteLength || undefined);
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (offset !== fileSize) throw new Error("The stored media file is incomplete.");
  return { bytes: output, mimeType, fileSize };
}

export function cookieClear() {
  return "kpr_sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
}

export { constantTimeEqual };
