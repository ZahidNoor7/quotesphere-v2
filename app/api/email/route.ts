import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { withTenant } from "@/lib/with-tenant";
import { requireRole } from "@/lib/rbac";
import { sendInvoiceEmail, sendQuotationEmail, sendPaymentReminderEmail } from "@/lib/email";

const sendSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("invoice"),
    to: z.email(),
    customerName: z.string().min(1),
    invoiceNo: z.string().min(1),
    issueDate: z.string().min(1),
    dueDate: z.string().optional(),
    totalAmount: z.number(),
    currency: z.string(),
    companyName: z.string().min(1),
    invoiceUrl: z.string().optional(),
    message: z.string().max(4000).optional(),
    pdfBase64: z.string().optional(),
  }),
  z.object({
    type: z.literal("quotation"),
    to: z.email(),
    customerName: z.string().min(1),
    quotationNo: z.string().min(1),
    issueDate: z.string().min(1),
    validUntil: z.string().optional(),
    totalAmount: z.number(),
    currency: z.string(),
    companyName: z.string().min(1),
    message: z.string().max(4000).optional(),
    pdfBase64: z.string().optional(),
  }),
  z.object({
    type: z.literal("payment_reminder"),
    to: z.email(),
    customerName: z.string().min(1),
    invoiceNo: z.string().min(1),
    dueDate: z.string().min(1),
    outstandingAmount: z.number(),
    currency: z.string(),
    companyName: z.string().min(1),
    daysOverdue: z.number().default(0),
  }),
]);

export const POST = withTenant("POST /api/email", async (req: NextRequest) => {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const denied = requireRole(session, req.method);
    if (denied) return denied;

    const body = await req.json();
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
    }

    const payload = parsed.data;
    let result: { id?: string; error?: string };

    if (payload.type === "invoice") {
      result = await sendInvoiceEmail(payload);
    } else if (payload.type === "quotation") {
      result = await sendQuotationEmail(payload);
    } else {
      result = await sendPaymentReminderEmail(payload);
    }

    if (result.error) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }
    // No id + no error means the send was skipped because email isn't configured.
    // For a user-initiated send that's a failure, not a silent success.
    if (!result.id) {
      return NextResponse.json(
        { success: false, error: "Email isn't configured. Set up a provider in Settings → Integrations → Email." },
        { status: 503 },
      );
    }
    return NextResponse.json({ success: true, data: { id: result.id } });
  } catch (err) {
    console.error("[email POST]", err);
    return NextResponse.json({ success: false, error: "Failed to send email" }, { status: 500 });
  }
});
