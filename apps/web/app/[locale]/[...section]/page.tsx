import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/photography/header";
import { copy } from "@/components/photography/copy";
import { places, projects } from "@/components/photography/data";
import { localize, type Locale } from "@/components/photography/types";
import styles from "@/components/photography/photography.module.css";

export const metadata = { title: "SHEPS.LOG", robots: { index: false, follow: false } };

export default async function CollectionPlaceholder({ params }: { params: Promise<{ locale: string; section: string[] }> }) {
  const { locale: language, section } = await params;
  if (language !== "zh" && language !== "en") notFound();
  const locale = language as Locale;
  const text = copy[locale];
  const [category, slug] = section;
  if (!Object.hasOwn(text.nav, category) || section.length > 2) notFound();
  let title: string = text.nav[category as keyof typeof text.nav];
  if (slug) {
    const item = category === "projects" ? projects.find((item) => item.slug === slug)
      : category === "places" ? places.find((item) => item.slug === slug) : null;
    if (!item) notFound();
    title = localize("title" in item ? item.title : item.name, locale);
  }
  return <div className={styles.site}><Header locale={locale} />
    <main className={styles.placeholder}><h1>{title}</h1><p>{text.soon}</p><Link href={`/${locale}`}>{text.home} →</Link></main>
  </div>;
}
