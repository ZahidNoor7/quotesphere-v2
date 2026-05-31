import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@/auth";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import Quotation from "@/models/Quotation";
import { requireRole } from "@/lib/rbac";
import { withLog } from "@/lib/logger";
import { mintPrintToken, type PrintDocType } from "@/lib/print-token";
import { getBrowser } from "@/lib/pdf/browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby allows up to 300s; 60 covers cold start + render

const BASE_URL =
  process.env.PDF_BASE_URL ??
  process.env.NEXTAUTH_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

// Vercel function response bodies are capped at 4.5 MB — large (image-heavy) PDFs
// are uploaded to Cloudinary and returned as a URL instead of raw bytes.
const MAX_INLINE_BYTES = 4_000_000;

async function uploadPdf(pdf: Uint8Array, fileName: string): Promise<string> {
  const { v2: cloudinary } = await import("cloudinary");
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const dataUri = `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`;
  const res = await cloudinary.uploader.upload(dataUri, {
    resource_type: "raw",
    folder: "quotesphere/pdf",
    public_id: fileName.replace(/\.pdf$/i, ""),
    format: "pdf",
  });
  return res.secure_url;
}

export const GET = withLog(
  "GET /api/pdf/[type]/[id]",
  async (_req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) => {
    try {
      const session = await auth();
      if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
      const denied = requireRole(session, "GET");
      if (denied) return denied;

      const { type, id } = await params;
      if (type !== "invoice" && type !== "quotation") {
        return NextResponse.json({ success: false, error: "Invalid document type" }, { status: 400 });
      }
      if (!isValidObjectId(id)) {
        return NextResponse.json({ success: false, error: "Invalid ID" }, { status: 400 });
      }

      await connectDB();
      const exists = type === "invoice" ? await Invoice.exists({ _id: id }) : await Quotation.exists({ _id: id });
      if (!exists) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

      const uid = String((session.user as { id?: string } | undefined)?.id ?? "");
      const token = mintPrintToken(type as PrintDocType, id, uid);
      const url = `${BASE_URL}/print/${type}/${id}?token=${encodeURIComponent(token)}`;

      const browser = await getBrowser();
      const page = await browser.newPage();
      try {
        await page.goto(url, { waitUntil: "networkidle0", timeout: 45_000 });
        await page.evaluateHandle("document.fonts.ready");
        const pdf = await page.pdf({
          printBackground: true,
          preferCSSPageSize: true, // page size/orientation/margins come from the design's @page (PrintDocument)
        });

        const fileName = `${type === "invoice" ? "Invoice" : "Quotation"}-${id}.pdf`;
        if (pdf.byteLength > MAX_INLINE_BYTES) {
          const hostedUrl = await uploadPdf(pdf, fileName);
          return NextResponse.json({ success: true, url: hostedUrl });
        }
        return new NextResponse(Buffer.from(pdf), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Cache-Control": "no-store",
          },
        });
      } finally {
        await page.close();
      }
    } catch (err) {
      console.error("[pdf route]", err);
      return NextResponse.json({ success: false, error: "Failed to generate PDF" }, { status: 500 });
    }
  },
);
