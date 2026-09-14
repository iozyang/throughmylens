"use client";

import { useState, type CSSProperties } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { PhotographyImage } from "./photography-image";
import { FullscreenViewer } from "./fullscreen-viewer";
import type { Locale, Photograph, ViewerSelection } from "./types";
import shared from "./photography.module.css";
import styles from "./work-gallery.module.css";
import { useLiveMetadata } from "./use-live-metadata";
import { WorkEnding } from "./work-ending";

// Keep editorial order and natural ratios. Panoramas have their own row.
function arrangeRows(photographs: Photograph[]) {
  const rows: Photograph[][] = [];
  let row: Photograph[] = [];
  for (const photograph of photographs) {
    if (photograph.width / photograph.height >= 2.2) {
      if (row.length) rows.push(row);
      rows.push([photograph]); row = [];
    } else {
      row.push(photograph);
      if (row.length === 3) { rows.push(row); row = []; }
    }
  }
  if (row.length) rows.push(row);
  return rows;
}

export function WorkGallery({ locale, photographs: initialPhotographs }: { locale: Locale; photographs: Photograph[] }) {
  const selectedWorkPhotographs = useLiveMetadata(initialPhotographs);
  const rows = arrangeRows(selectedWorkPhotographs);
  const [selection, setSelection] = useState<ViewerSelection | null>(null);
  const zh = locale === "zh";
  return <div className={shared.site} lang={zh ? "zh-CN" : "en"}>
    <a className={shared.skip} href="#work-gallery">{zh ? "跳至作品" : "Skip to photographs"}</a>
    <Header locale={locale} />
    <main id="work-gallery" className={styles.main} tabIndex={-1}>
      <div className={styles.heading}>
        <h1>{zh ? "作品" : "Work"}</h1>
        <p>{selectedWorkPhotographs.length} {zh ? "幅作品" : "photographs"}</p>
      </div>
      {rows.length ? <div className={styles.collection}>
        {rows.map((row) => <div key={row[0].id} className={styles.row}
          data-single-portrait={row.length === 1 && row[0].width < row[0].height}>
          {row.map((photograph) => <figure key={photograph.id} className={styles.frame}
            style={{ "--photo-ratio": photograph.width / photograph.height } as CSSProperties}>
            <PhotographyImage photograph={photograph} locale={locale} layout="gallery" onView={setSelection}
              sizes={`(max-width: 760px) calc(100vw - 48px), (min-width: 1840px) ${Math.ceil(1680 * photograph.width / photograph.height / row.reduce((sum, item) => sum + item.width / item.height, 0))}px, ${Math.ceil(92 * photograph.width / photograph.height / row.reduce((sum, item) => sum + item.width / item.height, 0))}vw`} />
          </figure>)}
        </div>)}
      </div> : <p className={styles.empty}>{zh ? "作品正在整理中。" : "Photographs are being prepared."}</p>}
    </main>
    <WorkEnding disabled={!!selection}><Footer photographs={selectedWorkPhotographs} locale={locale} /></WorkEnding>
    {selection && <FullscreenViewer selection={selection} photograph={selectedWorkPhotographs.find(p => p.id === selection.photograph.id)} locale={locale} onClose={() => setSelection(null)} />}
  </div>;
}
