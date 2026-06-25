import type { Metadata } from "next";
import { getBaseUrl } from "@/lib/assistant/base-url";
import { getPublicPlans } from "@/lib/marketing/plans";
import { FAQ_ITEMS } from "@/lib/marketing/content";
import { Hero } from "@/components/marketing/hero";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { FeatureModules } from "@/components/marketing/feature-modules";
import { SecuritySection } from "@/components/marketing/security-section";
import { DualCurrency } from "@/components/marketing/dual-currency";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";

const SITE_URL = getBaseUrl();
const TITLE = "QuoteSphere · Run your whole business in one place";
const DESCRIPTION =
  "Quoting, invoicing, expenses, projects, payroll and an AI assistant in one platform. Pixel-perfect PDFs, dual-currency (PKR + USD) billing, and strict per-tenant security.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "QuoteSphere",
  alternates: { canonical: "/" },
  keywords: [
    "invoicing software",
    "quotation software",
    "business management",
    "payroll software Pakistan",
    "expense tracking",
    "project management",
    "PKR USD invoicing",
    "QuoteSphere",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "QuoteSphere",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default async function MarketingPage() {
  const plans = await getPublicPlans();

  // Structured data (controlled, static content — safe). Helps search engines and
  // social previews understand the product, plans and FAQ.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "QuoteSphere",
        url: SITE_URL,
        description: DESCRIPTION,
      },
      {
        "@type": "WebSite",
        name: "QuoteSphere",
        url: SITE_URL,
      },
      {
        "@type": "SoftwareApplication",
        name: "QuoteSphere",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: plans.map((p) => ({
          "@type": "Offer",
          name: p.name,
          price: p.priceUsd,
          priceCurrency: "USD",
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ_ITEMS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Controlled data, not user input — standard Next.js JSON-LD pattern.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <TrustStrip />
      <FeatureModules />
      <SecuritySection />
      <DualCurrency />
      <Pricing plans={plans} />
      <Faq />
      <FinalCta />
    </>
  );
}
