"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { SectionHeading } from "./section-heading";
import { copy } from "./copy";
import { localize, type Locale, type Photograph, type Place } from "./types";
import styles from "./photography.module.css";

export function PlacesPreview({ places, photographs, locale }: { places: Place[]; photographs: Photograph[]; locale: Locale }) {
  const [active, setActive] = useState<string | null>(null);
  const text = copy[locale];
  const place = places.find((item) => item.slug === active);
  const photo = photographs.find((item) => item.id === place?.photographId);
  return <section className={styles.places} aria-labelledby="places-heading">
    <SectionHeading id="places-heading" title={text.places} href={`/${locale}/places`} label={text.explorePlaces} />
    <div className={styles.mapLayout}>
      <div className={styles.map} onKeyDown={(event) => { if (event.key === "Escape") setActive(null); }}>
        {/* Static, local coastline: no tracking, third-party map requests or map controls. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/world-coastline.svg" width="1080" height="540" alt="" aria-hidden="true" />
        {places.map((item) => <button key={item.slug} className={styles.mapMarker}
          style={{ left: `${(item.coordinates[0] + 180) / 3.6}%`, top: `${(90 - item.coordinates[1]) / 1.8}%` }}
          aria-label={localize(item.name, locale)} aria-pressed={active === item.slug}
          onMouseEnter={() => setActive(item.slug)} onFocus={() => setActive(item.slug)}
          onClick={() => setActive(item.slug)}><span /></button>)}
      </div>
      <div className={styles.placeDetail} aria-live="polite">
        {place && photo ? <Link key={place.slug} href={`/${locale}/places/${place.slug}`}>
          <Image src={photo.src} alt={localize(photo.alt, locale)} width={photo.width} height={photo.height} quality={80} sizes="240px" />
          <span>{localize(place.name, locale)} <span aria-hidden="true">↗</span></span>
          <small>{locale === "zh" ? "演示地点" : "Demo location"}</small>
        </Link> : <p>{locale === "zh" ? "从一个地点开始。" : "Begin with a place."}</p>}
      </div>
    </div>
    <div className={styles.placeIndex} aria-label={text.places}>
      {places.map((item) => <button key={item.slug} aria-pressed={active === item.slug}
        onMouseEnter={() => setActive(item.slug)} onFocus={() => setActive(item.slug)} onClick={() => setActive(item.slug)}>
        {localize(item.name, locale)}
      </button>)}
    </div>
  </section>;
}
