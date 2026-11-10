# Email setup for beginners — EDCKPRCAS website enquiries

This is a step-by-step guide to make every valid website enquiry reach `edc@kprcas.ac.in`.

## How the email system works

1. A visitor submits the Reach Us form on the website.
2. Cloudflare Pages Function validates the form.
3. The function saves the enquiry in the online Cloudflare D1 Enquiry Inbox first.
4. The function sends the enquiry to Resend using its HTTPS API.
5. Resend delivers it to `edc@kprcas.ac.in`.
6. The visitor's submitted address is placed in Reply-To, so the EDC team can reply directly.
7. The online CMS records whether Resend accepted the email and any delivery error.

If Resend is not set up or returns an error, the enquiry remains saved in the online CMS inbox. The visitor sees that the form was saved but email could not be sent. This prevents an email outage from silently discarding the enquiry.

This release does not send an automatic acknowledgement to the visitor. It sends the enquiry to the EDC mailbox.

## What you need

- A deployed Cloudflare Pages project with the D1 database binding `DB` configured.
- Access to Cloudflare Pages project Settings.
- A Resend account.
- Permission to add DNS records for an approved sender domain.
- An active receiving mailbox: `edc@kprcas.ac.in`.

The website address and email sender domain are separate. You cannot use the free `pages.dev` hostname as the sender domain in Resend.

## Step 1 — Create a Resend account

1. Open `https://resend.com/signup`.
2. Create the account and verify the registration email if asked.
3. Choose the Free plan. Current published limits are 3,000 emails/month and 100 emails/day. Do not activate Pro, paid add-ons or pay-as-you-go.
4. Open the Resend dashboard.

## Step 2 — Choose a sender domain

Use one sender domain you are authorised to configure. Recommended first choice, subject to KPRCAS IT approval:

- Sender domain: `send.kprcas.ac.in`
- Sender address: `website@send.kprcas.ac.in`
- Recipient: `edc@kprcas.ac.in`

Alternative if KPRCAS IT cannot add DNS records and your friend later grants DNS access:

- Sender domain: `send.edckprcas.co.in`
- Sender address: `website@send.edckprcas.co.in`
- Recipient remains: `edc@kprcas.ac.in`

Do not use `pages.dev` as a sender domain. Do not guess that an address exists: Resend authorises the domain for sending; KPRCAS IT should approve the sender identity and receiving mailbox policy.

## Step 3 — Add and verify the domain in Resend

1. In Resend, open **Domains**.
2. Select **Add Domain**.
3. Enter the chosen sender domain, such as `send.kprcas.ac.in`.
4. Select the appropriate region if Resend asks and keep the default sending configuration unless IT specifies otherwise.
5. Resend will generate the exact DNS records required for verification and sending, commonly DKIM and SPF-related records.
6. Copy the record names, types and values exactly as shown in your Resend dashboard.
7. Send the records to the authorised DNS administrator. A message template is included below.
8. Wait for the administrator to confirm the records have been added.
9. Return to Resend → Domains and select **Verify** or refresh the status until it shows verified/ready.

### Very important DNS safety

Do not delete, replace or disturb institutional MX, SPF, DKIM, DMARC or domain-verification records. If Resend asks for an SPF record at a hostname that already has one, the mail administrator must merge the required include into the existing SPF record; do not create two SPF TXT records for the same hostname. Add only the exact records Resend generated.

### Message to send KPRCAS IT or your domain owner

> I am configuring the EDCKPRCAS website enquiry form to send visitor enquiries to edc@kprcas.ac.in using Resend. Please approve the sender subdomain [send.kprcas.ac.in OR send.edckprcas.co.in]. Resend has generated DNS verification/sending records. Please add the exact records attached, without disturbing existing institutional MX, SPF, DKIM, DMARC or other mail services. If an SPF record already exists for the same hostname, please merge the required include into the existing record rather than creating a duplicate. Please confirm once the records are in place so I can verify the domain in Resend.

## Step 4 — Create a Resend API key

Do this after the sender domain is verified.

1. In Resend, open **API Keys**.
2. Select **Create API Key**.
3. Name it `EDCKPRCAS Cloudflare Website`.
4. Select sending-only/least-privilege access if the option is offered.
5. Restrict it to the verified sender domain if Resend offers that setting.
6. Create the key and copy it immediately.
7. Store it privately in a password manager or an approved institutional record.
8. Never paste it into GitHub, a website JavaScript file, screenshots, the local `.env.example` or a public message.

## Step 5 — Add email configuration to Cloudflare Pages

1. Open `https://dash.cloudflare.com/`.
2. Select **Workers & Pages**.
3. Select your EDCKPRCAS Pages project.
4. Open **Settings → Variables and Secrets**.
5. Select **Production** (not Preview).
6. Add these plain-text variables, using the verified sender address you chose:

| Variable | Preferred sender value |
|---|---|
| `MAIL_FROM` | `EDCKPRCAS Website <website@send.kprcas.ac.in>` |
| `MAIL_TO` | `edc@kprcas.ac.in` |
| `ALLOWED_ORIGINS` | `https://YOUR-PAGES-HOSTNAME.pages.dev` |

7. Add `RESEND_API_KEY` separately.
8. Paste the Resend key and save it as an encrypted **Secret**, not a plain variable.
9. Save the variables.
10. If the Pages project already has a production deployment, trigger a new deployment so the new Function environment is active.

If using the alternative sender domain, change `MAIL_FROM` to:

`EDCKPRCAS Website <website@send.edckprcas.co.in>`

Keep `MAIL_TO` as `edc@kprcas.ac.in`.

If Cloudflare assigned a hostname other than the example, use the exact hostname. `ALLOWED_ORIGINS` is a comma-separated list of complete origins, without trailing slash. Later include the official website origin as well.

## Step 6 — Confirm the contact email settings and live test

1. Open the temporary public Pages website.
2. Open Reach Us.
3. Submit a real test using an email address you can access.
4. Confirm the form says the enquiry was emailed and saved, not merely saved.
5. Open `edc@kprcas.ac.in` and check Inbox, Spam and any institutional quarantine.
6. Confirm the name, visitor email, subject and complete message are present.
7. Select Reply and check that the reply is addressed to the visitor's email.
8. Open the online Content Manager → Enquiry inbox. The enquiry should be present and show the email status.
9. If the email is not delivered, open the enquiry in the CMS to view the recorded Resend error, check Resend's email logs, and check Cloudflare Pages Function logs. Do not treat an HTTP success alone as proof of actual mailbox receipt.

## Step 7 — When the official website domain is connected

If the sender remains `send.kprcas.ac.in`, you do not need to change Resend merely because the website moves from `pages.dev` to `edckprcas.co.in`.

If the sender is `send.edckprcas.co.in`, keep its verification DNS records in place when the friend connects the site domain.

Update the Cloudflare Function variable `ALLOWED_ORIGINS` to include the exact active website origins, for example:

`https://YOUR-PAGES-HOSTNAME.pages.dev,https://edckprcas.co.in,https://www.edckprcas.co.in`

If using `edc.edckprcas.co.in`, include that exact origin instead. Update the build variables `SITE_URL` and `MEDIA_BASE_URL` to the final website hostname, redeploy, and submit another test enquiry.

## Troubleshooting

- **Resend says domain not verified:** check each DNS record's name/type/value with the authorised DNS administrator; allow time for DNS propagation; refresh verification.
- **Resend rejects the sender:** confirm `MAIL_FROM` uses the exact verified sender domain and that the sender is authorised in Resend.
- **403 from contact endpoint:** check that the visitor is on a hostname listed in `ALLOWED_ORIGINS`, and that there is no trailing slash or typo.
- **Enquiry appears in CMS but no email arrives:** the online save worked; inspect the enquiry's `emailError`, Resend logs, API key, sender verification and receiving mailbox spam/quarantine.
- **Website says email not configured:** add `RESEND_API_KEY` as an encrypted Secret and set `MAIL_FROM` and `MAIL_TO`, then redeploy.
- **D1 error:** check the Pages binding is named exactly `DB`, all migrations ran successfully and the project has been redeployed after adding the binding.

Do not share the Resend API key or CMS secrets with anyone. The actual live email test must be completed in your accounts before announcing the contact form is operational.
