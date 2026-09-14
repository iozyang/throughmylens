"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PhotographyImage } from "./photography-image";
import { copy } from "./copy";
import { rebaseStripPosition, resizeStripPosition } from "./strip-geometry";
import type { Locale, Photograph, ViewerSelection } from "./types";
import styles from "./photography.module.css";

export function SelectedWorkStrip({ photographs, locale, paused, onView, controls }: {
  photographs: Photograph[]; locale: Locale; paused: boolean; onView: (selection: ViewerSelection) => void;
  controls?: ReactNode;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const interaction = useRef({ hover: false, focus: false, down: false, dragged: false, touch: false, x: 0, idleUntil: 0 });
  const [hint, setHint] = useState(false);
  const motion = useRef({ paused });
  const sequenceKey = photographs.map(photo => `${photo.id}:${photo.width}:${photo.height}`).join("|");

  // Motion preferences must not tear down the scroll geometry. In particular,
  // opening the viewer must leave its source photograph exactly where it was.
  useEffect(() => { motion.current = { paused }; }, [paused]);

  useEffect(() => {
    const element = viewport.current, sequence = group.current;
    if (!element || !sequence) return;
    let visible = false, frame = 0, previous = 0, position = 0, width = 0;
    const measure = () => {
      const nextWidth = sequence.getBoundingClientRect().width;
      position = resizeStripPosition(element.scrollLeft, width, nextWidth);
      width = nextWidth; element.scrollLeft = position;
    };
    measure();
    const resize = new ResizeObserver(measure); resize.observe(sequence);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    intersection.observe(element);
    // Recycle at the boundary during dragging/inertia too, not just when idle.
    // No scroll handler may extend idle time in response to our own RAF writes.
    const recycle = () => {
      if (!width) return;
      const next = rebaseStripPosition(element.scrollLeft, width);
      if (next !== element.scrollLeft) { element.scrollLeft = next; position = element.scrollLeft; }
    };
    element.addEventListener("scroll", recycle, { passive: true });
    const tick = (now: number) => {
      const elapsed = previous ? Math.min(now - previous, 40) : 0; previous = now;
      const state = interaction.current;
      const manual = state.down || state.hover || state.focus || now < state.idleUntil;
      if (width && !motion.current.paused) {
        const rebased = rebaseStripPosition(element.scrollLeft, width);
        if (rebased !== element.scrollLeft) {
          element.scrollLeft = rebased; position = element.scrollLeft;
        }
      }
      if (!motion.current.paused && visible && !document.hidden && !manual) {
        position += element.clientWidth * elapsed / 28000;
        element.scrollLeft = position;
      } else position = element.scrollLeft;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); element.removeEventListener("scroll", recycle); };
  }, [sequenceKey]);

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    try { if (localStorage.getItem("sheps-photo-hint-v1")) return; } catch { /* Private browsing. */ }
    let timer: ReturnType<typeof setTimeout>;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setHint(true); observer.disconnect();
      try { localStorage.setItem("sheps-photo-hint-v1", "seen"); } catch { /* Optional preference only. */ }
      timer = setTimeout(() => setHint(false), 5000);
    }, { threshold: .3 });
    if (viewport.current) observer.observe(viewport.current);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, []);

  return <div className={styles.stripWrap}>
    <div ref={viewport} className={styles.strip} data-testid="work-strip" role="region" aria-label={copy[locale].selectedWork}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") interaction.current.hover = true; }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") interaction.current.hover = false;
        if (!interaction.current.dragged) interaction.current.down = false;
      }}
      onFocusCapture={(event) => {
        interaction.current.focus = !interaction.current.touch && event.target.matches(":focus-visible");
        interaction.current.idleUntil = performance.now() + 1400;
      }}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) interaction.current.focus = false; }}
      onPointerDown={(event) => {
        const state = interaction.current;
        state.down = true; state.dragged = false; state.touch = event.pointerType !== "mouse"; state.x = event.clientX;
        if (state.touch) { state.hover = false; state.focus = false; }
      }}
      onPointerMove={(event) => {
        const state = interaction.current;
        if (!state.down || state.touch) return;
        const dx = event.clientX - state.x;
        if (!state.dragged && Math.abs(dx) < 5) return;
        state.dragged = true; state.x = event.clientX;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.scrollLeft -= dx;
      }}
      onPointerUp={(event) => {
        interaction.current.down = false; interaction.current.idleUntil = performance.now() + 1400;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { interaction.current.down = false; interaction.current.idleUntil = performance.now() + 1400; }}
      onLostPointerCapture={() => { interaction.current.down = false; }}
      onWheel={() => { interaction.current.idleUntil = performance.now() + 1400; }}
      onClickCapture={(event) => {
        // A prior mouse drag must not suppress a later keyboard Enter activation.
        if (event.detail !== 0 && interaction.current.dragged) { event.preventDefault(); event.stopPropagation(); }
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault(); event.currentTarget.scrollLeft += (event.key === "ArrowRight" ? 1 : -1) * 280;
        }
      }}>
      {[0, 1, 2].map((repeat) => <div key={repeat} className={styles.stripGroup} ref={repeat === 1 ? group : undefined} aria-hidden={repeat !== 1 ? true : undefined}>
        {photographs.map((photograph) => <PhotographyImage key={photograph.id} photograph={photograph} locale={locale}
          duplicate={repeat !== 1} onView={onView} />)}
      </div>)}
    </div>
    <div className={styles.motionControl}>
      <p className={styles.mobileHint} data-visible={hint} aria-hidden={!hint}>{copy[locale].hint}</p>
      {controls}
    </div>
  </div>;
}
