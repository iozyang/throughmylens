import { copy } from "./copy";
import type { Locale, Photograph } from "./types";
import styles from "./photography.module.css";

export function Footer({ photographs, locale }: { photographs: Photograph[]; locale: Locale }) {
  const demo = photographs.filter((photo) => photo.demo);
  return <footer className={styles.footer}>
    <span>© SHEPS.LOG / {new Date().getFullYear()}</span>
    {!!demo.length && <details className={styles.credits}>
      <summary>{copy[locale].credits}</summary>
      <p>{copy[locale].demo}</p>
      {demo.map((photo) => <a key={photo.id} href={photo.credit.url} target="_blank" rel="noreferrer">{photo.credit.name} / Unsplash ↗</a>)}
      <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash License ↗</a>
      <a href="https://github.com/topojson/world-atlas" target="_blank" rel="noreferrer">Map: Natural Earth / world-atlas ↗</a>
    </details>}
  </footer>;
}
