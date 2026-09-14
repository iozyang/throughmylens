"use client";

import { useState } from "react";
import { Header } from "./header";
import { HeroSlideshow } from "./hero-slideshow";
import { SelectedWorkStrip } from "./selected-work-strip";
import { FullscreenViewer } from "./fullscreen-viewer";
import { SelectedProjects } from "./selected-projects";
import { PlacesPreview } from "./places-preview";
import { Footer } from "./footer";
import { SectionHeading } from "./section-heading";
import { photographs, heroIds, projects, places } from "./data";
import { copy } from "./copy";
import type { Locale, Photograph, ViewerSelection } from "./types";
import styles from "./photography.module.css";
import { useLiveMetadata } from "./use-live-metadata";

const hero = heroIds.flatMap((id) => photographs.filter((photo) => photo.id === id));

export function Homepage({ locale, workPhotographs: initialPhotographs }: { locale: Locale; workPhotographs: Photograph[] }) {
  const workPhotographs = useLiveMetadata(initialPhotographs);
  const [selection, setSelection] = useState<ViewerSelection | null>(null);
  const [paused, setPaused] = useState(false);
  const text = copy[locale];
  return <div className={styles.site} lang={locale === "zh" ? "zh-CN" : "en"}>
    <a className={styles.skip} href="#selected-work">{text.skip}</a>
    <Header locale={locale} overlay />
    <main>
      <h1 className={styles.srOnly}>SHEPS.LOG</h1>
      <HeroSlideshow photographs={hero} locale={locale} paused={paused || !!selection} />
      <section id="selected-work" className={styles.work} aria-labelledby="work-heading" tabIndex={-1}>
        <SectionHeading id="work-heading" title={text.selectedWork} label={text.exploreWork} href={`/${locale}/work`} />
        <SelectedWorkStrip photographs={workPhotographs} locale={locale} paused={paused || !!selection} onView={setSelection}
          controls={<button onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? text.play : text.pause}</button>} />
      </section>
      <SelectedProjects projects={projects} photographs={photographs} locale={locale} />
      <PlacesPreview places={places} photographs={photographs} locale={locale} />
    </main>
    <Footer photographs={photographs} locale={locale} />
    {selection && <FullscreenViewer selection={selection} photograph={workPhotographs.find(p => p.id === selection.photograph.id)} locale={locale} onClose={() => setSelection(null)} />}
  </div>;
}
