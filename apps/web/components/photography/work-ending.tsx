"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { atPageEnd, resistanceTarget, stepResistance } from "./end-resistance";
import styles from "./work-gallery.module.css";

export function WorkEnding({ children, disabled }: { children: ReactNode; disabled: boolean }) {
  const motion = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = motion.current;
    if (!node || disabled) return;
    const allowed = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let frame = 0, previous = 0, lastInput = 0, input = 0;
    let state = { position: 0, velocity: 0 };
    const reset = () => {
      cancelAnimationFrame(frame); frame = 0; previous = 0; input = 0;
      state = { position: 0, velocity: 0 };
      node.style.removeProperty("--end-displacement");
      node.style.removeProperty("will-change");
    };
    const tick = (now: number) => {
      if (!allowed.matches || document.hidden) { reset(); return; }
      if (now - lastInput > 110) input = 0;
      state = stepResistance(state, resistanceTarget(input), previous ? (now - previous) / 1000 : 1 / 60);
      previous = now;
      node.style.setProperty("--end-displacement", `${state.position.toFixed(3)}px`);
      if (process.env.NODE_ENV === "development") {
        node.dataset.resistancePeak = String(Math.max(Number(node.dataset.resistancePeak || 0), state.position));
      }
      if (!input && state.position < .01 && Math.abs(state.velocity) < .03) { reset(); return; }
      frame = requestAnimationFrame(tick);
    };
    const wheel = (event: WheelEvent) => {
      if (!allowed.matches || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey
        || document.hidden || document.querySelector("dialog[open]") || document.body.style.overflow === "hidden") return;
      const root = document.scrollingElement;
      if (!root || !atPageEnd(root.scrollTop, root.scrollHeight, root.clientHeight)) { reset(); return; }
      // A nested scrollable element owns its wheel input, even at its own edge.
      for (let target = event.target instanceof Element ? event.target : null; target && target !== root; target = target.parentElement) {
        if (target.scrollHeight > target.clientHeight + 1 && /auto|scroll|overlay/.test(getComputedStyle(target).overflowY)) return;
      }
      if (event.deltaY <= 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) { input = 0; return; }
      const now = performance.now();
      if (now - lastInput > 110) input = 0;
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? root.clientHeight : 1);
      input = Math.min(1800, input + pixels); lastInput = now;
      if (!frame) { node.style.willChange = "transform"; frame = requestAnimationFrame(tick); }
    };
    // Observe intent only: never preventDefault, change scrollTop or intercept touch.
    window.addEventListener("wheel", wheel, { passive: true });
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    allowed.addEventListener("change", reset);
    return () => {
      reset(); window.removeEventListener("wheel", wheel); window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset); allowed.removeEventListener("change", reset);
    };
  }, [disabled]);
  return <div className={styles.ending} data-testid="work-ending">
    <div ref={motion} className={styles.endMotion}>
      <div className={styles.endDivider} aria-hidden="true" />
      {children}
    </div>
  </div>;
}
