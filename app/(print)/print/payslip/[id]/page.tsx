import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import Payslip from "@/models/Payslip";
import PayPeriod from "@/models/PayPeriod";
import Settings from "@/models/Settings";
import { verifyPrintToken } from "@/lib/print-token";
import { runWithOrg } from "@/lib/tenant-context";
import { buildPayslipData } from "@/lib/payroll/payslip-doc-data";
import { PayslipPrint } from "@/components/payroll/payslip-print";

// Token-gated, no caching — rendered only by the headless-Chrome PDF route.
export const dynamic = "force-dynamic";

export default async function PayslipPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const tokenRaw = (await searchParams).token;
  const token = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw;

  if (!isValidObjectId(id)) notFound();
  const payload = verifyPrintToken(token, "payslip", id);
  if (!payload) notFound();

  await connectDB();
  // Scoped to the token's org so the tenant plugin only resolves that org's data.
  const { slip, settings, period } = await runWithOrg(payload.org, async () => {
    const s = await Payslip.findById(id).lean();
    const set = s ? await Settings.findOne({}).lean() : null;
    const per = s ? await PayPeriod.findById((s as { payPeriodId?: unknown }).payPeriodId).lean() : null;
    return { slip: s, settings: set, period: per };
  });
  if (!slip) notFound();

  const data = buildPayslipData(
    slip as unknown as Parameters<typeof buildPayslipData>[0],
    settings as unknown as Parameters<typeof buildPayslipData>[1],
    period as unknown as Parameters<typeof buildPayslipData>[2],
  );
  return <PayslipPrint data={data} />;
}
