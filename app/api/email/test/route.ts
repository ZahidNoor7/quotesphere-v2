import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { sendTestEmail } from "@/lib/email";
import { resolveSubmittedSecret } from "@/lib/settings-secrets";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const schema = z.object({
  to: z.email("Enter a valid recipient email"),
  config: z.object({
    enabled: z.boolean().optional(),
    provider: z.enum(["resend", "smtp"]).optional(),
    apiKey: z.string().optional(),
    smtpHost: z.string().optional(),
    smtpPort: z.number().optional(),
    smtpUser: z.string().optional(),
    smtpPassword: z.string().optional(),
    smtpSecure: z.boolean().optional(),
    fromName: z.string().optional(),
    fromEmail: z.string().optional(),
  }),
});

/** Send a one-off test email using the config the user is editing (verify before saving). */
export const POST = withTenant("POST /api/email/test", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method, "update"); // same level as saving integrations
    if (denied) return denied;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "A valid recipient email is required." }, { status: 400 });
    }

    // Secrets are masked on read; if the caller submitted the mask (testing a
    // saved integration without re-typing), fall back to the stored credential.
    await connectDB();
    const stored = (await Settings.findOne({}).select("integrations.email").lean()) as any;
    const e = stored?.integrations?.email ?? {};
    const config = {
      ...parsed.data.config,
      apiKey: resolveSubmittedSecret(parsed.data.config.apiKey, e.apiKey),
      smtpPassword: resolveSubmittedSecret(parsed.data.config.smtpPassword, e.smtpPassword),
    };

    const r = await sendTestEmail(config, parsed.data.to);
    if (r.error) return NextResponse.json({ success: false, error: r.error }, { status: 400 });
    return NextResponse.json({ success: true, id: r.id });
  } catch (err: any) {
    console.error("[email/test POST]", err);
    return NextResponse.json({ success: false, error: err.message || "Test failed" }, { status: 500 });
  }
});
