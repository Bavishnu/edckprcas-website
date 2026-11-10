#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');

function loadEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) throw new Error('Missing .env. Copy .env.example to .env and enter your Resend settings first.');
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const at = line.indexOf('='); if (at < 1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

(async () => {
  try {
    loadEnv();
    const apiKey = String(process.env.RESEND_API_KEY || '').trim();
    const from = String(process.env.MAIL_FROM || '').trim();
    const to = String(process.env.MAIL_TO || 'edc@kprcas.ac.in').trim();
    if (!apiKey || /YOUR_|PASTE_|PLACEHOLDER/i.test(apiKey)) throw new Error('RESEND_API_KEY is missing or still a placeholder in .env.');
    if (!from || !to) throw new Error('MAIL_FROM and MAIL_TO must both be set in .env.');
    console.log(`Sending one test email from ${from} to ${to}...`);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [to], subject: 'EDCKPRCAS website email configuration test',
        text: 'This is a test message from the EDCKPRCAS website configuration check. If you received this email, the Resend API key, verified sender domain and recipient routing are working.'
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}: ${body.message || body.name || JSON.stringify(body)}`);
    console.log('SUCCESS: Resend accepted the test email.');
    console.log(`Email ID: ${body.id || '(not returned)'}`);
    console.log(`Recipient: ${to}`);
    console.log('Now check Inbox, Spam and institutional quarantine. A successful API response confirms provider acceptance, not final inbox delivery.');
  } catch (error) {
    console.error(`EMAIL TEST FAILED: ${error.message}`);
    process.exitCode = 1;
  }
})();
