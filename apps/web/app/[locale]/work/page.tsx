import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkGallery } from "@/components/photography/work-gallery";
import { selectedWorkPhotographs } from "@/components/photography/selected-work";

export function generateStaticParams() {
  return [{ locale: "zh" }, { locale: "en" }];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: { absolute: locale === "zh" ? "作品 — SHEPS.LOG" : "Work — SHEPS.LOG" },
    description: locale === "zh" ? "SHEPS.LOG 摄影作品集。" : "A collection of photographs by SHEPS.LOG.",
    robots: { index: false, follow: false },
  };
}

export default async function WorkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "zh" && locale !== "en") notFound();
  return <WorkGallery locale={locale} photographs={selectedWorkPhotographs} />;
}
