# Set up the AI assistant

The AI assistant lets you create and manage everything by **chatting** (see **The AI assistant**), and it also powers **bill scanning** on expenses. To use it, connect an AI provider in **Settings → Integrations → AI Assistant**.

You pick **one** provider and paste an API key. Supported: **OpenAI**, **Azure OpenAI**, and **Anthropic (Claude)**.

## Get an API key

Pick whichever you have (or find easiest):

**OpenAI** (simplest)
1. Go to **platform.openai.com** and sign in.
2. Open **API keys → Create new secret key** and copy it (starts with `sk-`).
3. You'll add billing/credits in your OpenAI account. A good model name is `gpt-4o`.

**Anthropic (Claude)**
1. Go to **console.anthropic.com** and sign in.
2. Open **API Keys → Create Key** and copy it.
3. A good model name is `claude-sonnet-4-6`.

**Azure OpenAI** (for businesses already on Azure)
1. In the Azure portal, create an **Azure OpenAI** resource and a model **deployment**.
2. Note your **endpoint**, **API key**, **deployment name**, and **API version**.

## Connect it in QuoteSphere

1. Go to **Settings → Integrations → AI Assistant** and turn it **on**.
2. Choose your **provider**.
3. Paste your **API key** and the **model** name. (For Azure, also enter the endpoint, deployment and API version.)
4. Click **Test connection**, then **Save**.

## Choosing a model

- For chatting (creating invoices, quotes, etc.), any current model works.
- For **bill scanning**, pick a model that can read images — **gpt-4o**, **gpt-5**, or **claude-sonnet** all work.

> **Privacy & cost:** your API key is stored in your settings and used only to power your assistant. Usage is billed by your AI provider (OpenAI/Anthropic/Azure), not by QuoteSphere — most small businesses spend very little.

## Turning capabilities on and off

In the **assistant's own settings** you can switch individual abilities on or off (for example, allow invoices but not deleting). The assistant only ever offers the capabilities you've enabled.

## Replying in your language

The assistant can answer in whatever language you write in. Open the **assistant's own settings** and find **Response language**:

- **Auto — match the customer's language** (the default): the assistant replies in the same language as each message. Write in Urdu and it answers in Urdu; ask in Arabic, French, Spanish or English and it matches you automatically — no setting to change.
- **A specific language**: pick one (English, Urdu, Arabic, French and more) and every reply comes back in that language, no matter what language you type in.

Either way, your own details — customer and product names, currency codes and document numbers like INV-00042 — are always kept exactly as you entered them.
