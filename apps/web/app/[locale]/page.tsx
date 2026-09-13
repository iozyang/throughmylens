import { notFound } from "next/navigation";

import { Homepage } from "@/components/photography/homepage";
import { selectedWorkPhotographs } from "@/components/photography/selected-work";
import type { Metadata } from "next";

const supportedLocales = ["zh", "en"] as const;
type Locale = (typeof supportedLocales)[number];

export const metadata: Metadata = {
  title: { absolute: "SHEPS.LOG — Photography" },
  description: "Photographs, projects and places. SHEPS.LOG.",
  robots: { index: false, follow: false }, // Local design preview contains clearly credited demo work.
};

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

export default async function LocaleHomePage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!supportedLocales.includes(locale as Locale)) {
    notFound();
  }

  return <Homepage locale={locale as Locale} workPhotographs={selectedWorkPhotographs} />;
}
