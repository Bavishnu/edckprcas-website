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
    return host.endsWith(".pages.dev") || host === "edckprcas.co.in" || host === "www.edckprcas.co.in" || host === "edc.kprcas.ac.in";
  } catch { return false; }
}

function safeAppsScriptUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" &&
      url.hostname === "script.google.com" &&
      /^\/(?:macros\/s\/[^/]+\/exec|a\/macros\/[^/]+\/s\/[^/]+\/exec)\/?$/.test(url.pathname) &&
      !url.search && !url.hash;
  } catch { return false; }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!allowedOrigin(request, env) || !sameOrigin(request)) {
    return json({ error: "This form can only be submitted from the EDCKPRCAS website." }, 403);
  }
  if (!env.DB) {
    return json({ error: "The website enquiry service is temporarily unavailable. Please email edc@kprcas.ac.in directly." }, 503);
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "Send the enquiry as JSON." }, 415);
  }

  let body;
  try { body = await readJson(request, 32 * 1024); }
  catch (error) { return json({ error: error.message || "The enquiry details could not be read." }, 400); }

  // Honeypot: silently accept the request without saving or emailing it.
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

  // Limit abuse from a single source address before consuming the institutional email quota.
  const clientIp = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipHash = await sha256Hex(clientIp);
  const nowMs = Date.now();
  const limit = await env.DB.prepare("SELECT window_started, attempts FROM cms_contact_limits WHERE ip_hash = ?").bind(ipHash).first();
  const withinWindow = limit && (nowMs - Number(limit.window_started)) < 60 * 60 * 1000;
  if (withinWindow && Number(limit.attempts) >= 8) {
    return json({ error: "For security, please wait before sending another enquiry." }, 429, {
      "retry-after": String(Math.max(1, Math.ceil((Number(limit.window_started) + 60 * 60 * 1000 - nowMs) / 1000)))
    });
  }
  if (withinWindow) {
    await env.DB.prepare("UPDATE cms_contact_limits SET attempts = attempts + 1 WHERE ip_hash = ?").bind(ipHash).run();
  } else {
    await env.DB.prepare("INSERT INTO cms_contact_limits (ip_hash, window_started, attempts) VALUES (?, ?, 1) ON CONFLICT(ip_hash) DO UPDATE SET window_started = excluded.window_started, attempts = 1").bind(ipHash, nowMs).run();
  }

  // Save first. An email outage must never discard the visitor's enquiry.
  const id = crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO cms_inquiries (id, name, email, subject, message, received_at, status, email_sent, email_error, email_id) VALUES (?, ?, ?, ?, ?, ?, 'New', 0, NULL, NULL)"
  ).bind(id, name, email, subject, message, receivedAt).run();

  const scriptUrl = String(env.GOOGLE_APPS_SCRIPT_URL || "").trim();
  const bridgeToken = String(env.GOOGLE_APPS_SCRIPT_TOKEN || "").trim();
  const to = "edc@kprcas.ac.in";
  if (!scriptUrl || !bridgeToken) {
    return json({
      ok: true,
      emailSent: false,
      emailConfigured: false,
      message: "Your enquiry has been saved in the online Content Manager inbox, but email notifications are not configured yet. Please email edc@kprcas.ac.in directly for urgent matters."
    }, 202);
  }
  if (!safeAppsScriptUrl(scriptUrl)) {
    await env.DB.prepare("UPDATE cms_inquiries SET email_sent = 0, email_error = ?, email_id = NULL WHERE id = ?")
      .bind("The Google Apps Script deployment URL is invalid. Use the HTTPS /macros/s/.../exec URL.", id).run();
    return json({
      ok: true, emailSent: false, emailConfigured: true,
      message: "Your enquiry has been saved, but the institutional email connection is misconfigured. The EDC team can still review it in the online inbox."
    }, 202);
  }

  const website = new URL(request.url).origin;
  let emailSent = false;
  let emailError = null;
  let emailId = null;

  try {
    // Apps Script ContentService intentionally redirects its response to
    // script.googleusercontent.com. Read the redirect manually: following a
    // 302 automatically can turn this POST into a GET and call doGet() instead
    // of returning the doPost() mail result.
    let response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      // Apps Script validates this high-entropy token against Script Properties.
      // The recipient is fixed inside Code.gs and is never accepted from the visitor.
      body: JSON.stringify({
        token: bridgeToken,
        inquiryId: id,
        timestamp: Date.now(),
        name,
        email,
        subject,
        message,
        receivedAt,
        website
      }),
      redirect: "manual"
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("Location");
      if (!location) throw new Error("Google Apps Script redirected without a Location header.");
      const resultUrl = new URL(location, scriptUrl);
      // ContentService results are served from Google's one-time user-content host.
      // Refuse unexpected redirect targets rather than forwarding anything elsewhere.
      if (resultUrl.protocol !== "https:" || resultUrl.hostname !== "script.googleusercontent.com") {
        throw new Error("Google Apps Script returned an unexpected redirect destination.");
      }
      response = await fetch(resultUrl.toString(), {
        method: "GET",
        headers: { "Accept": "application/json" },
        redirect: "follow"
      });
    }

    const responseText = await response.text();
    let result = {};
    try { result = JSON.parse(responseText); }
    catch {
      throw new Error("Google Apps Script returned a non-JSON response. Check that the web app is deployed for anonymous access and that the /exec URL is used.");
    }
    if (!response.ok || result.ok !== true) {
      throw new Error(String(result.error || result.message || `Google Apps Script returned HTTP ${response.status}.`).slice(0, 260));
    }
    // doGet() returns {ok:true, ready:true}; that is only a health check,
    // never proof that doPost() called MailApp. Require the POST receipt ID.
    if (!result.messageId || typeof result.messageId !== "string") {
      throw new Error("Google Apps Script did not return a mail-send receipt. The endpoint health check is not an email confirmation.");
    }
    emailSent = true;
    emailId = String(result.messageId).slice(0, 200);
  } catch (error) {
    emailError = String(error?.message || "The institutional Google email service could not be reached.").slice(0, 300);
  }

  await env.DB.prepare("UPDATE cms_inquiries SET email_sent = ?, email_error = ?, email_id = ? WHERE id = ?")
    .bind(emailSent ? 1 : 0, emailError, emailId, id).run();

  if (emailSent) {
    return json({
      ok: true,
      emailSent: true,
      emailConfigured: true,
      message: "Thank you. Your enquiry has been saved and submitted through the EDCKPRCAS institutional Gmail account to edc@kprcas.ac.in."
    }, 201);
  }
  return json({
    ok: true,
    emailSent: false,
    emailConfigured: true,
    message: "Your enquiry has been saved in the online Content Manager inbox, but the institutional email notification could not be sent. Please email edc@kprcas.ac.in directly for urgent matters."
  }, 202);
}
