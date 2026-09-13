"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { flipTransform } from "./gallery-geometry";

export function useGalleryLayout(gridRef: RefObject<HTMLDivElement | null>, mode: number) {
  const first = useRef(new Map<HTMLElement, DOMRect>());
  const anchor = useRef<{ node: HTMLElement; top: number } | null>(null);
  const animations = useRef(new Map<HTMLElement, Animation>());
  const capture = useCallback((x?: number, y?: number) => {
    const nodes = Array.from(gridRef.current?.querySelectorAll<HTMLElement>("[data-photo-id]") || []);
    first.current = new Map(nodes.map(node => [node, node.getBoundingClientRect()]));
    const underPointer = x !== undefined && y !== undefined ? document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-photo-id]") : null;
    const visible = nodes.filter(n => { const r = first.current.get(n)!; return r.bottom > 150 && r.top < innerHeight; });
    const center = [...visible].sort((a, b) => {
      const ra = first.current.get(a)!, rb = first.current.get(b)!;
      return Math.abs(ra.top + ra.height / 2 - innerHeight / 2) - Math.abs(rb.top + rb.height / 2 - innerHeight / 2);
    })[0];
    const node = underPointer && gridRef.current?.contains(underPointer) ? underPointer : center;
    anchor.current = node ? { node, top: first.current.get(node)!.top } : null;
    // Rects include the current visual transform: interrupt and retarget safely.
    animations.current.forEach(a => a.cancel()); animations.current.clear();
  }, [gridRef]);
  useLayoutEffect(() => {
    if (!first.current.size || !gridRef.current) return;
    const started = performance.now();
    const saved = anchor.current;
    if (saved?.node.isConnected) window.scrollBy({ top: saved.node.getBoundingClientRect().top - saved.top, behavior: "instant" });
    const candidates = [...first.current].map(([node, before]) => ({ node, before, after: node.getBoundingClientRect() })).filter(({ before, after }) => (before.bottom > -100 && before.top < innerHeight + 100) || (after.bottom > -100 && after.top < innerHeight + 100));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const { node, before, after } of candidates.slice(0, 96)) {
      if (reduced || !node.animate || !after.width || !after.height) continue;
      const animation = node.animate([{ transform: flipTransform(before, after), transformOrigin: "0 0" }, { transform: "none", transformOrigin: "0 0" }], { duration: 340, easing: "cubic-bezier(.22,1,.36,1)" });
      animations.current.set(node, animation);
      animation.finished.then(() => { if (animations.current.get(node) === animation) animations.current.delete(node); }).catch(() => {});
    }
    if (process.env.NODE_ENV === "development") {
      gridRef.current.setAttribute("data-layout-ms", (performance.now() - started).toFixed(2));
      gridRef.current.setAttribute("data-animated-count", String(reduced ? 0 : Math.min(96, candidates.length)));
      gridRef.current.setAttribute("data-anchor", saved?.node.dataset.photoId || "");
      gridRef.current.setAttribute("data-anchor-before", String(saved?.top ?? ""));
      gridRef.current.setAttribute("data-anchor-drift", String(saved ? (candidates.find(c => c.node === saved.node)?.after.top ?? saved.top) - saved.top : 0));
    }
    first.current.clear(); anchor.current = null;
  }, [mode, gridRef]);
  useEffect(() => { const running = animations.current; return () => running.forEach(a => a.cancel()); }, []);
  return capture;
}
