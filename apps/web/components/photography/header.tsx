"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { copy } from "./copy";
import type { Locale } from "./types";
import styles from "./photography.module.css";

export function Header({ locale, overlay = false }: { locale: Locale; overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const text = copy[locale];
  const pathname = usePathname();
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);
  return (
    <header className={`${styles.header} ${overlay ? styles.headerOverlay : ""}`}
      onKeyDown={(event) => { if (event.key === "Escape" && open) { setOpen(false); toggle.current?.focus(); } }}>
      <Link href={`/${locale}`} className={styles.brand} aria-label="SHEPS.LOG — Home">SHEPS.LOG</Link>
      <button ref={toggle} className={styles.menuToggle} aria-expanded={open}
        aria-controls="public-navigation" onClick={() => setOpen(!open)}>
        {open ? text.close : text.menu}
      </button>
      <nav id="public-navigation" aria-label={locale === "zh" ? "主导航" : "Main navigation"}
        className={styles.navigation} data-open={open}
        onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } }}>
        {Object.entries(text.nav).map(([slug, label]) => (
          <Link key={slug} href={`/${locale}/${slug}`} aria-current={pathname === `/${locale}/${slug}` ? "page" : undefined}
            onClick={() => setOpen(false)}>{label}</Link>
        ))}
        <Link className={styles.language} href={pathname.replace(/^\/(zh|en)(?=\/|$)/, locale === "zh" ? "/en" : "/zh")}
          hrefLang={locale === "zh" ? "en" : "zh-CN"} aria-label={text.language}>
          {locale === "zh" ? "EN" : "中"}
        </Link>
      </nav>
    </header>
  );
}
