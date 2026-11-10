import { json, readJson, sameOrigin, sha256Hex } from "../_lib/cms.js";

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}
function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    const normalized = new URL(origin).origin;
    const configured = String(env.ALLOWED_ORIGINS || "")
      .split(",").map(value => value.trim()).filter(Boolean)
      .map(value => { try { return new URL(value).origin; } catch { return ""; } })
      .filter(Boolean);
    if (configured.length) return configured.includes(normalized);
    const host = new URL(normalized).hostname.toLowerCase();
    return host.endsWith(".pages.dev") || host === "edckprcas.co.in" || host === "www.edckprcas.co.in";
  } catch { return false; }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!allowedOrigin(request, env) || !sameOrigin(request)) return json({ error: "This form can only be submitted from the EDCKPRCAS website." }, 403);
  if (!env.DB) return json({ error: "The website enquiry service is temporarily unavailable. Please email edc@kprcas.ac.in directly." }, 503);
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return json({ error: "Send the enquiry as JSON." }, 415);

  let body;
  try { body = await readJson(request, 32 * 1024); }
  catch (error) { return json({ error: error.message || "The enquiry details could not be read." }, 400); }

  if (String(body.website || "").trim()) {
    return json({ ok: true, emailSent: false, message: "Thank you. Your enquiry has been received." }, 201);
  }

  const name = String(body.name || "").trim().slice(0, 100);
  const email = String(body.email || "").trim().slice(0, 160);
  const subject = String(body.subject || "EDCKPRCAS website enquiry").replace(/[\r\n]+/g, " ").trim().slice(0, 160);
  const message = String(body.message || "").trim().slice(0, 5000);
  if (name.length < 2 || !validEmail(email) || message.length < 10) {
    return json({ error: "Please provide your name, a valid email address and a message of at least 10 characters." }, 400);
  }

  // Limit abuse from a single source address before consuming email quota.
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipHash = await sha256Hex(clientIp);
  const nowMs = Date.now();
  const limit = await env.DB.prepare("SELECT window_started, attempts FROM cms_contact_limits WHERE ip_hash = ?").bind(ipHash).first();
  const withinWindow = limit && (nowMs - Number(limit.window_started)) < 60 * 60 * 1000;
  if (withinWindow && Number(limit.attempts) >= 8) {
    return json({ error: "For security, please wait before sending another enquiry." }, 429, { "retry-after": String(Math.max(1, Math.ceil((Number(limit.window_started) + 60 * 60 * 1000 - nowMs) / 1000))) });
  }
  if (withinWindow) {
    await env.DB.prepare("UPDATE cms_contact_limits SET attempts = attempts + 1 WHERE ip_hash = ?").bind(ipHash).run();
  } else {
    await env.DB.prepare("INSERT INTO cms_contact_limits (ip_hash, window_started, attempts) VALUES (?, ?, 1) ON CONFLICT(ip_hash) DO UPDATE SET window_started = excluded.window_started, attempts = 1").bind(ipHash, nowMs).run();
  }

  const id = crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO cms_inquiries (id, name, email, subject, message, received_at, status, email_sent, email_error, email_id) VALUES (?, ?, ?, ?, ?, ?, 'New', 0, NULL, NULL)"
  ).bind(id, name, email, subject, message, receivedAt).run();

  const apiKey = String(env.RESEND_API_KEY || "").trim();
  const from = String(env.MAIL_FROM || "").trim();
  const to = String(env.MAIL_TO || "edc@kprcas.ac.in").trim();
  if (!apiKey || !from || !to) {
    return json({
      ok: true,
      emailSent: false,
      emailConfigured: false,
      message: "Your enquiry has been saved in the online Content Manager inbox, but email notifications are not configured yet. Please email edc@kprcas.ac.in directly for urgent matters."
    }, 202);
  }

  const emailText = [
    "A new enquiry was submitted through the EDCKPRCAS website.",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Subject: ${subject}`,
    "",
    "Message:",
    message,
    "",
    `Website: ${new URL(request.url).origin}`,
    `Received: ${receivedAt}`
  ].join("\n");

  let emailSent = false;
  let emailError = null;
  let emailId = null;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: subject || "EDCKPRCAS website enquiry",
        text: emailText
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      emailError = `Resend rejected the message (${response.status}): ${String(result.message || result.name || "Check the verified sender and API key.").slice(0, 220)}`;
    } else {
      emailSent = true;
      emailId = String(result.id || "");
    }
  } catch (error) {
    emailError = String(error?.message || "The email provider could not be reached.").slice(0, 260);
  }

  await env.DB.prepare("UPDATE cms_inquiries SET email_sent = ?, email_error = ?, email_id = ? WHERE id = ?")
    .bind(emailSent ? 1 : 0, emailError, emailId, id).run();

  if (emailSent) {
    return json({ ok: true, emailSent: true, emailConfigured: true, message: "Thank you. Your enquiry has been emailed to edc@kprcas.ac.in and saved in the online Content Manager inbox." }, 201);
  }
  return json({
    ok: true,
    emailSent: false,
    emailConfigured: true,
    message: "Your enquiry has been saved in the online Content Manager inbox, but the email notification could not be delivered. Please email edc@kprcas.ac.in directly for urgent matters."
  }, 202);
}
