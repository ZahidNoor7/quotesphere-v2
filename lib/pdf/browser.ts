import type { Browser } from "puppeteer-core";

/**
 * Headless-Chrome launcher for server-side PDF generation.
 *
 * - Production (Vercel): `puppeteer-core` + `@sparticuz/chromium-min`, with the
 *   Chromium brotli pack fetched at runtime from `CHROMIUM_PACK_URL` (a pinned
 *   @sparticuz/chromium release tar) and cached in /tmp. Keeps the function
 *   bundle well under Vercel's 250 MB limit.
 * - Local dev: `puppeteer-core` driving the developer's installed Chrome
 *   (`channel: "chrome"`), or `PUPPETEER_EXECUTABLE_PATH` if set. No heavy
 *   full-`puppeteer` Chromium download required.
 *
 * VERSION PINNING: `puppeteer-core` (25.x) and `@sparticuz/chromium-min` (149.x,
 * Chromium 149) are pinned to a matching pair. A mismatch causes launch/protocol
 * failures — bump both together.
 *
 * A module-level singleton is reused across invocations on a warm serverless
 * instance, so only the first (cold) request pays the launch cost.
 */
let browserPromise: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;

  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const packUrl = process.env.CHROMIUM_PACK_URL;
    if (!packUrl) {
      throw new Error("CHROMIUM_PACK_URL is required in production (pinned @sparticuz/chromium release tar).");
    }
    return puppeteer.launch({
      args: [...chromium.args, "--font-render-hinting=none"],
      defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 2 },
      executablePath: await chromium.executablePath(packUrl),
      headless: true,
    });
  }

  // Local development — use the system Chrome (no bundled Chromium download).
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  return puppeteer.launch({
    headless: true,
    executablePath,
    channel: executablePath ? undefined : "chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 2 },
  });
}

export async function getBrowser(): Promise<Browser> {
  const existing = await browserPromise?.catch(() => null);
  if (existing && existing.connected) return existing;
  browserPromise = launch();
  return browserPromise;
}
