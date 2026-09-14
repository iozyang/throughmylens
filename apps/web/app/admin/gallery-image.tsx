"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { privateImageUrl, type Photo } from "./photo-api";
import { imageSizes, nearGalleryLayout } from "./gallery-geometry";
import styles from "./asset-manager.module.css";

export function imageCandidates(photo: Photo) {
  return [...new Map([...photo.assets].sort((a, b) => a.width - b.width).map(a => [a.width, a])).values()];
}

export default function GalleryImage({ photo, mode, index, onOpen }: { photo: Photo; mode: number; index: number; onOpen: () => void }) {
  const tile = useRef<HTMLButtonElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const [near, setNear] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const candidates = imageCandidates(photo);
  const thumbnail = photo.assets.find(a => a.kind === "thumbnail") || candidates[0];
  const signature = candidates.map(a => `${a.width}:${a.url}`).join("|");
  const sizes = imageSizes(mode);
  const srcSet = candidates.map(a => `${privateImageUrl(a.url)} ${a.width}w`).join(", ");
  const width = photo.record.width || photo.width || 1, height = photo.record.height || photo.height || 1;

  useEffect(() => {
    const node = tile.current;
    if (!node) return;
    if (process.env.NODE_ENV === "development") node.dataset.mountToken = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const observer = new IntersectionObserver(entries => { for (const entry of entries) setNear(entry.isIntersecting); }, { rootMargin: `${innerHeight}px 0px` });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const node = image.current;
    if (!near || !node || !thumbnail) return;
    // An old IntersectionObserver result may still say "near" in the render
    // that expands the grid. Recheck new geometry before requesting HQ bytes.
    const tileNode = tile.current, gridNode = tileNode?.offsetParent;
    if (!tileNode || !gridNode || !nearGalleryLayout(gridNode.getBoundingClientRect().top, tileNode.offsetTop, tileNode.offsetHeight, innerHeight)) return;
    let active = true;
    const upgrade = new Image();
    upgrade.decoding = "async"; upgrade.sizes = sizes; upgrade.srcset = srcSet; upgrade.src = privateImageUrl(thumbnail.url);
    upgrade.decode().then(() => {
      if (!active) return;
      // Do not clear the displayed bitmap while a larger candidate downloads.
      node.sizes = sizes; node.srcset = srcSet; node.src = upgrade.currentSrc || upgrade.src;
      node.dataset.requestedWidth = String(candidates.find(a => privateImageUrl(a.url) === upgrade.currentSrc)?.width || upgrade.naturalWidth);
      setLoaded(true); setFailed(false);
    }).catch(() => { if (active && !node.complete) setFailed(true); });
    return () => { active = false; };
  // Candidate values are represented by signature; object identity changes on
  // admin polling must not restart decoding.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, sizes, srcSet, signature, thumbnail?.url]);

  return <button ref={tile} data-photo-id={photo.id} data-image-loaded={loaded} className={styles.tile}
    style={{ "--photo-ratio": `${width} / ${height}` } as CSSProperties} onClick={onOpen}
    aria-label={`查看 ${photo.record.title.zh || photo.record.location.display.zh || photo.filename}`}>
    {thumbnail && <img ref={image} src={privateImageUrl(thumbnail.url)} alt={photo.record.alt.zh || ""} width={width} height={height}
      loading={near || index < 4 ? "eager" : "lazy"} fetchPriority={index < 2 ? "high" : "auto"} decoding="async" draggable={false}
      onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
    {(!thumbnail || (failed && !loaded)) && <span>{photo.processing_status === "failed" || failed ? "图片暂不可用" : "处理中"}</span>}
  </button>;
}
