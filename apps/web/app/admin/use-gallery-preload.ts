"use client";
import { useEffect, type RefObject } from "react";
import { privateImageUrl, type Photo } from "./photo-api";
import { imageCandidates } from "./gallery-image";
import { imageSizes } from "./gallery-geometry";

export function useGalleryPreload(grid: RefObject<HTMLDivElement | null>, photos: Photo[], mode: number) {
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "")) return;
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout>;
    let idle: number | undefined;
    const warmed = new Set<string>();
    const run = async () => {
      if (running || stopped) return;
      running = true;
      try {
      const nodes = Array.from(grid.current?.querySelectorAll<HTMLElement>("[data-photo-id]") || []);
      const nearby = nodes.filter(n => { const r = n.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight * 1.5; }).slice(0, 4);
      for (const node of nearby) {
        if (stopped) return;
        const photo = photos.find(p => p.id === node.dataset.photoId);
        if (!photo || warmed.has(photo.id)) continue;
        const candidates = imageCandidates(photo);
        const largest = candidates.at(-1);
        if (!largest) continue;
        const img = new Image(); img.fetchPriority = "low"; img.decoding = "async";
        // Smaller adjacent modes can reuse the current bitmap. Warm only the
        // larger neighbour, sequentially, for at most four near-screen photos.
        img.sizes = imageSizes(Math.min(4, mode + 1));
        img.srcset = candidates.map(a => `${privateImageUrl(a.url)} ${a.width}w`).join(", ");
        img.src = privateImageUrl(largest.url);
        warmed.add(photo.id);
        try { await img.decode(); } catch { /* Current bitmap remains visible. */ }
      }
      } finally { running = false; }
    };
    const cancelIdle = () => { if (idle !== undefined) { window.cancelIdleCallback(idle); idle = undefined; } };
    const schedule = () => {
      clearTimeout(timer); cancelIdle();
      timer = setTimeout(() => {
        if (window.requestIdleCallback) idle = window.requestIdleCallback(() => { idle = undefined; void run(); }, { timeout: 1200 });
        else void run();
      }, 650);
    };
    schedule(); window.addEventListener("scroll", schedule, { passive: true });
    return () => { stopped = true; clearTimeout(timer); cancelIdle(); window.removeEventListener("scroll", schedule); };
  }, [grid, photos, mode]);
}
