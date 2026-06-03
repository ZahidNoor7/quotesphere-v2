# Connect WhatsApp

Connecting WhatsApp lets you **chat with clients** in the Messaging screen, **send invoices and quotations as PDFs** over WhatsApp, and send **payment reminders** by WhatsApp. QuoteSphere uses a WhatsApp Business provider called **360dialog**.

## Get a WhatsApp API key

1. Create an account with **360dialog** (360dialog.com) and follow their steps to connect a **WhatsApp Business** number.
2. From your 360dialog hub, copy your **API key**.

> 360dialog offers a **Sandbox** for testing (limited to ~200 messages and text only) and a **Production** key for real use (lets you send PDF documents). You can start in Sandbox and switch to Production later.

## Connect it in QuoteSphere

1. Go to **Settings → Integrations → WhatsApp** and turn it **on**.
2. Choose the **mode** — **Sandbox** (testing) or **Production** (live).
3. Paste your **API key** and the **WhatsApp phone number** you connected.
4. Click **Test connection** to confirm it works, then **Save**.
5. (Optional) Use **Register webhook** so incoming replies show up in your Messaging inbox.

## Using it

- Open **Messaging** to chat with clients and see replies.
- From an invoice or quotation, choose to send it on **WhatsApp** — the PDF is delivered as an attachment (Production mode).
- Turn on **WhatsApp** under **Settings → Reminders** to chase overdue invoices automatically.

> **Good to know:** WhatsApp has a **24-hour rule** — outside a 24-hour window since the customer last messaged you, the customer generally has to message you first before you can send them a free-form message. Sandbox mode is text-only; switch to Production to send PDF documents.
