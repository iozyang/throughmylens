export const galleryColumns = [16, 8, 4, 3, 1] as const;
export type Rect = { left: number; top: number; width: number; height: number };
// offsetTop/offsetHeight describe the target layout, unlike a DOMRect while
// FLIP is still animating the tile from its old on-screen position.
export function nearGalleryLayout(gridTop: number, offsetTop: number, height: number, viewportHeight: number) {
  const top = gridTop + offsetTop;
  return top + height >= -viewportHeight && top <= viewportHeight * 2;
}
export function flipTransform(before: Rect, after: Rect) {
  return `translate(${before.left - after.left}px, ${before.top - after.top}px) scale(${before.width / Math.max(1, after.width)}, ${before.height / Math.max(1, after.height)})`;
}
export function imageSizes(mode: number) {
  if (mode === 4) return "(max-width: 600px) calc(100vw - 16px), min(1100px, calc(100vw - clamp(32px, 8vw, 160px)))";
  const n = galleryColumns[mode];
  return `(max-width: 600px) calc((100vw - ${16 + (n - 1) * 2}px) / ${n}), calc((100vw - clamp(32px, 8vw, 160px) - ${(n - 1) * 3}px) / ${n})`;
}
