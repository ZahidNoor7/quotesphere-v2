import chalk from "chalk";
import { NextRequest, NextResponse } from "next/server";

// ─── Method badge colors ────────────────────────────────────────────────────
const METHOD_BADGE: Record<string, (s: string) => string> = {
  GET:    (s) => chalk.bgGreen.black.bold(s),
  POST:   (s) => chalk.bgBlue.white.bold(s),
  PUT:    (s) => chalk.bgYellow.black.bold(s),
  PATCH:  (s) => chalk.bgCyan.black.bold(s),
  DELETE: (s) => chalk.bgRed.white.bold(s),
};

const statusColor = (code: number) => {
  if (code < 300) return chalk.green.bold;
  if (code < 400) return chalk.cyan.bold;
  if (code < 500) return chalk.yellow.bold;
  return chalk.red.bold;
};

const SEP = chalk.gray("─".repeat(80));
const THIN = chalk.gray("·".repeat(80));

const SHOW_HEADERS = new Set([
  "content-type",
  "user-agent",
  "accept",
  "host",
  "referer",
  "x-forwarded-for",
  "x-real-ip",
  "origin",
]);

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function truncate(s: string, max = 700): string {
  return s.length > max ? s.slice(0, max) + chalk.gray(" …[truncated]") : s;
}

// ─── Core logger ────────────────────────────────────────────────────────────
async function logRequest(req: NextRequest | Request, route: string) {
  const method = req.method ?? "GET";
  const timestamp = new Date().toISOString();
  let pathname = "";
  let search = "";
  try {
    const u = new URL(req.url);
    pathname = u.pathname;
    search = u.search;
  } catch {
    pathname = req.url ?? "";
  }

  const badge = (METHOD_BADGE[method] ?? chalk.bgWhite.black.bold)(` ${method} `);

  // Filter headers
  const headers: [string, string][] = [];
  req.headers.forEach((v, k) => {
    const lower = k.toLowerCase();
    if (SHOW_HEADERS.has(lower)) headers.push([k, v]);
    else if (lower === "authorization") headers.push([k, chalk.gray("[REDACTED]")]);
    else if (lower === "cookie") headers.push([k, chalk.gray("[REDACTED]")]);
  });

  // Capture body
  let bodyStr = "";
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      try {
        const body = await (req as NextRequest).clone().json();
        // Redact sensitive fields
        const sanitized = { ...body };
        for (const key of ["password", "newPassword", "currentPassword", "token", "secret"]) {
          if (key in sanitized) sanitized[key] = "[REDACTED]";
        }
        bodyStr = JSON.stringify(sanitized, null, 2);
      } catch { /* ignore */ }
    } else if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
      bodyStr = "[FormData — binary content omitted]";
    }
  }

  console.log();
  console.log(SEP);
  console.log(
    `  ${badge}  ${chalk.white.bold(route.padEnd(45))} ${chalk.gray(timestamp)}`
  );
  console.log(
    `  ${chalk.gray("URL      ")} ${chalk.cyan(pathname)}${search ? chalk.gray(search) : ""}`
  );

  if (headers.length > 0) {
    console.log(`  ${chalk.gray("Headers")}`);
    for (const [k, v] of headers) {
      console.log(`    ${chalk.gray(k.padEnd(24))} ${chalk.white(v)}`);
    }
  }

  if (bodyStr) {
    const indented = bodyStr.replace(/\n/g, "\n    ");
    console.log(`  ${chalk.gray("Body")}`);
    console.log(`    ${chalk.yellow(truncate(indented))}`);
  }
}

async function logResponse(response: NextResponse, durationMs: number) {
  const status = response.status;
  const color = statusColor(status);

  let resStr = "";
  let resSize = 0;
  try {
    const text = await response.clone().text();
    resSize = Buffer.byteLength(text, "utf8");
    const parsed = JSON.parse(text);
    resStr = JSON.stringify(parsed);
  } catch { /* ignore */ }

  const statusLabel = color(String(status));
  const dur = chalk.magenta(fmtDuration(durationMs));
  const size = chalk.cyan(fmtBytes(resSize));

  console.log();
  console.log(THIN);
  console.log(
    `  ${chalk.gray("Status   ")} ${statusLabel}  ${chalk.gray("│")}  ${chalk.gray("Time")} ${dur}  ${chalk.gray("│")}  ${chalk.gray("Size")} ${size}`
  );

  if (resStr) {
    const isError = status >= 400;
    const colored = isError ? chalk.red(truncate(resStr)) : chalk.green(truncate(resStr));
    console.log(`  ${chalk.gray("Response ")} ${colored}`);
  }

  console.log(SEP);
  console.log();
}

// ─── HOF wrapper ────────────────────────────────────────────────────────────
type AnyRouteHandler = (...args: any[]) => Promise<NextResponse>;

/**
 * Wrap any Next.js App Router handler with request/response logging.
 * Works with (req, ctx?), (), and (req: Request) signatures.
 */
export function withLog(route: string, handler: AnyRouteHandler): AnyRouteHandler {
  return async (req: NextRequest, ...rest: unknown[]): Promise<NextResponse> => {
    const start = performance.now();
    await logRequest(req, route);
    const response = await handler(req, ...rest);
    await logResponse(response, performance.now() - start);
    return response;
  };
}
