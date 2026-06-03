# Set up email

Connecting email lets QuoteSphere **send invoices, quotations and receipts**, and power **automatic payment reminders**. You set it up once in **Settings → Integrations → Email**.

You choose **one** of two providers — **Resend** or **SMTP / Gmail**. Only one is active at a time.

> Not sure which? **Resend** is best if you have your own domain (e.g. yourcompany.com). **Gmail/SMTP** is the quick option if you just want to send from a Gmail/Google Workspace address at low volume.

## Option A — Resend (recommended)

**Get your key**

1. Go to **resend.com** and create a free account.
2. Open **API Keys** → **Create API Key** → copy the key (it starts with `re_`).

**Verify your sending domain (so emails don't land in spam)**

3. In Resend, open **Domains → Add Domain** and enter your domain (e.g. `yourcompany.com`).
4. Resend shows you a few **DNS records** (an MX record and SPF/DKIM TXT records). Add them where your domain's DNS is managed (your domain registrar or host).
5. Wait until Resend shows the domain as **Verified**. (It's also good practice to add a DMARC record — Resend explains how.)

**Connect it in QuoteSphere**

6. Go to **Settings → Integrations → Email**, turn it **on**, and choose **Resend**.
7. Paste your **Resend API key**, set a **From name** (e.g. your company) and **From email** on your verified domain (e.g. `no-reply@yourcompany.com`).
8. Click **Send test** to email yourself, then **Save Email**.

> Just testing? You can use `onboarding@resend.dev` as the From email without verifying a domain — but it only delivers to your own Resend signup address, not to clients.

## Option B — SMTP / Gmail

This sends through your own mailbox. It works with **Gmail** or **Google Workspace** — but you must use an **App Password**, not your normal password.

1. On the Google account, turn on **2-Step Verification** (myaccount.google.com → Security).
2. Create an **App Password** at **myaccount.google.com/apppasswords** — you'll get a **16-character** password.
3. In **Settings → Integrations → Email**, turn it on and choose **SMTP / Gmail**, then enter:
   - **Host:** `smtp.gmail.com`
   - **Port:** `465` with **SSL on** (or `587` with SSL off)
   - **Username:** your full email address
   - **Password:** the **16-character App Password** (not your login password)
   - **From name** and **From email:** your email address
4. Click **Send test**, then **Save Email**.

> Limits: Gmail sends about **500 emails/day**. If you see a *"Username and Password not accepted"* error, you almost certainly used your normal password instead of an **App Password**, or 2-Step Verification isn't on yet.

## Try it

Type a recipient in **Send a test email** and click **Send test** — it sends with the settings on screen, so you can confirm it works *before* saving.
