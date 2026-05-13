import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { withLog } from "@/lib/logger";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

const RATE_PROVIDERS: Array<{
  url: (base: string) => string;
  parse: (json: any) => { rates: Record<string, number>; lastUpdated: Date };
}> = [
  {
    url: (base) => {
      const key = process.env.EXCHANGERATE_API_KEY;
      if (!key) throw new Error("EXCHANGERATE_API_KEY not set");
      return `https://v6.exchangerate-api.com/v6/${key}/latest/${base}`;
    },
    parse: (json) => {
      if (json.result !== "success") throw new Error(`exchangerate-api v6: ${json["error-type"] ?? "non-success"}`);
      return { rates: json.conversion_rates as Record<string, number>, lastUpdated: new Date(json.time_last_update_utc) };
    },
  },
  {
    url: (base) => `https://open.er-api.com/v6/latest/${base}`,
    parse: (json) => {
      if (json.result !== "success") throw new Error("open.er-api: non-success result");
      return { rates: json.rates, lastUpdated: new Date(json.time_last_update_utc) };
    },
  },
  {
    url: (base) => `https://api.exchangerate-api.com/v4/latest/${base}`,
    parse: (json) => {
      if (!json.rates) throw new Error("exchangerate-api v4: missing rates");
      return { rates: json.rates, lastUpdated: new Date(json.date) };
    },
  },
];

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchExternalRates(base: string): Promise<{ rates: Record<string, number>; lastUpdated: Date }> {
  const errors: string[] = [];
  for (const provider of RATE_PROVIDERS) {
    let url: string;
    try {
      url = provider.url(base);
    } catch (err: any) {
      errors.push(`Provider skipped: ${err.message}`);
      continue;
    }
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return provider.parse(json);
    } catch (err: any) {
      errors.push(`${url}: ${err.message ?? err}`);
    }
  }
  throw new Error(`All rate providers failed:\n${errors.join("\n")}`);
}

function serializeCurrencyRates(
  doc: any,
  base: string
): { base: string; rates: Record<string, number>; thresholds: Record<string, number>; lastUpdated: string | null } {
  return {
    base: doc?.base ?? base,
    rates: doc?.rates ?? {},
    thresholds: doc?.thresholds ?? {},
    lastUpdated: doc?.lastUpdated ? new Date(doc.lastUpdated).toISOString() : null,
  };
}

export const GET = withLog("GET /api/settings/currency-rates", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id as string;
    await connectDB();

    const { searchParams } = new URL(req.url);
    const requestedBase = searchParams.get("base");

    const settings = await Settings.findOne({ user_id: userId })
      .select("currencyRates default_currency")
      .lean() as any;

    const defaultCurrency: string = requestedBase ?? settings?.default_currency ?? "PKR";
    const cached = settings?.currencyRates;
    const now = Date.now();
    const lastUpdatedMs = cached?.lastUpdated ? new Date(cached.lastUpdated).getTime() : 0;
    const isStale = now - lastUpdatedMs > CACHE_TTL_MS;
    const baseChanged = cached?.base !== defaultCurrency;

    if (!cached || isStale || baseChanged) {
      try {
        const { rates } = await fetchExternalRates(defaultCurrency);
        const fetchedAt = new Date();
        const updated = await Settings.findOneAndUpdate(
          { user_id: userId },
          {
            $set: {
              "currencyRates.base": defaultCurrency,
              "currencyRates.rates": rates,
              "currencyRates.lastUpdated": fetchedAt,
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        ).select("currencyRates").lean() as any;

        return NextResponse.json({
          success: true,
          data: serializeCurrencyRates(updated?.currencyRates, defaultCurrency),
        });
      } catch (syncErr: any) {
        if (cached) {
          return NextResponse.json({ success: true, data: serializeCurrencyRates(cached, defaultCurrency) });
        }
        return NextResponse.json(
          { success: false, error: `Failed to fetch initial rates: ${syncErr.message}` },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ success: true, data: serializeCurrencyRates(cached, defaultCurrency) });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch currency rates" },
      { status: 500 }
    );
  }
});

export const POST = withLog("POST /api/settings/currency-rates", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as any).id as string;
    await connectDB();

    const settings = await Settings.findOne({ user_id: userId }).select("default_currency").lean() as any;
    const base: string = settings?.default_currency ?? "PKR";

    const { rates } = await fetchExternalRates(base);
    const fetchedAt = new Date();

    const updated = await Settings.findOneAndUpdate(
      { user_id: userId },
      {
        $set: {
          "currencyRates.base": base,
          "currencyRates.rates": rates,
          "currencyRates.lastUpdated": fetchedAt,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).select("currencyRates").lean() as any;

    return NextResponse.json({
      success: true,
      data: serializeCurrencyRates(updated?.currencyRates, base),
      message: "Rates synced successfully",
    });
  } catch (err: any) {
    const cause = err?.cause?.message ?? err?.cause ?? "";
    const message = cause ? `${err.message} (${cause})` : (err.message || "Sync failed");
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
});
