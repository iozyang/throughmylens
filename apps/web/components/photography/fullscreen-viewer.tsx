"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";
import { copy } from "./copy";
import { localize, type Locale, type ViewerSelection } from "./types";
import { useReducedMotion } from "./use-motion-preference";
import styles from "./photography.module.css";

export function FullscreenViewer({ selection, locale, onClose }: {
  selection: ViewerSelection; locale: Locale; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const picture = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);
  const animation = useRef<Animation | null>(null);
  const reduced = useReducedMotion();
  const photo = selection.photograph;

  const sourceTransform = useCallback(() => {
    const target = picture.current?.getBoundingClientRect();
    const source = selection.source.getBoundingClientRect();
    if (!target?.width || !source.width || !selection.source.isConnected || source.bottom < 0 || source.top > innerHeight
      || source.right < 0 || source.left > innerWidth) return null;
    return `translate(${source.left - target.left}px, ${source.top - target.top}px) scale(${source.width / target.width}, ${source.height / target.height})`;
  }, [selection]);

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    const previousOverflow = document.body.style.overflow;
    modal.showModal(); document.body.style.overflow = "hidden";
    closeButton.current?.focus({ preventScroll: true });
    const duration = reduced ? 1 : 380;
    const transform = sourceTransform();
    animation.current = picture.current!.animate(
      transform ? [{ transform }, { transform: "none" }] : [{ opacity: 0 }, { opacity: 1 }],
      { duration, easing: "cubic-bezier(.2,.7,.2,1)" },
    );
    backdrop.current!.animate([{ opacity: 0 }, { opacity: 1 }], { duration });
    return () => {
      animation.current?.cancel(); modal.close(); document.body.style.overflow = previousOverflow;
      // React Strict Mode rehearses effect cleanup while the dialog is still
      // mounted. Restoring/rebasing then would move the source during opening.
      if (!modal.isConnected && selection.source.isConnected) {
        // Loop copies are not keyboard stops. Restore their equivalent original,
        // rebasing the strip by exactly one sequence without changing visible imagery.
        const strip = selection.source.closest<HTMLElement>('[data-testid="work-strip"]');
        const original = strip && Array.from(strip.querySelectorAll<HTMLElement>("[data-photo-id]"))
          .find((element) => element.dataset.photoId === photo.id && element.tabIndex === 0);
        if (strip && original && original !== selection.source) {
          strip.scrollLeft += original.getBoundingClientRect().left - selection.source.getBoundingClientRect().left;
        }
        (original || selection.source).focus({ preventScroll: true });
      }
    };
  }, [selection, reduced, sourceTransform, photo.id]);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    // Cancel the opening transform before measuring the destination geometry.
    animation.current?.cancel();
    const transform = sourceTransform();
    const duration = reduced ? 1 : 340;
    const reverse = picture.current!.animate(
      transform ? [{ transform: "none" }, { transform }] : [{ opacity: 1 }, { opacity: 0 }],
      { duration, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" },
    );
    animation.current = reverse;
    backdrop.current!.animate([{ opacity: 1 }, { opacity: 0 }], { duration, fill: "forwards" });
    void reverse.finished.then(onClose).catch(() => {});
  };

  return <dialog ref={dialog} className={styles.viewer} aria-label={copy[locale].fullscreen}
    aria-describedby="viewer-help" onCancel={(event) => { event.preventDefault(); close(); }}
    onKeyDown={(event) => {
      // This deliberately minimal viewer has one interactive control.
      if (event.key === "Tab") { event.preventDefault(); closeButton.current?.focus(); }
    }}>
    <div ref={backdrop} className={styles.viewerBackdrop} onClick={close} aria-hidden="true" />
    <div className={styles.viewerStage} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={picture} className={styles.viewerPicture}
        style={{ aspectRatio: `${photo.width} / ${photo.height}`, width: `min(calc(100vw - 48px), calc((100svh - 140px) * ${photo.width / photo.height}))` }}>
        {/* The already decoded gallery image prevents a flash while the larger variant loads. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.viewerPreview} src={selection.previewSrc} alt="" aria-hidden="true" />
        <Image className={styles.viewerFull} src={photo.fullSrc || photo.src} alt={localize(photo.alt, locale)} fill quality={90}
          sizes={`min(calc(100vw - 48px), calc((100svh - 140px) * ${photo.width / photo.height}))`}
          loading="eager" onLoad={(event) => { event.currentTarget.style.opacity = "1"; }} />
      </div>
    </div>
    <button ref={closeButton} className={styles.viewerClose} onClick={close} aria-label={copy[locale].closeViewer}>
      <span aria-hidden="true">×</span>
    </button>
    <p id="viewer-help" className={styles.srOnly}>{copy[locale].viewerHelp}</p>
    <p className={styles.viewerCaption}>{(photo.location && localize(photo.location, locale).trim()) || photo.date}
      {photo.demo && <span>© {photo.credit.name} · {locale === "zh" ? "演示选片" : "Demo"}</span>}
    </p>
  </dialog>;
}
