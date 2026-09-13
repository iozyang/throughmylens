// Three bounded DOM buffers represent an unbounded sequence. Rebase during
// manual scrolling as well as autoplay, preserving the exact visual phase.
const phase = (position: number, width: number) => ((position % width) + width) % width;

export function rebaseStripPosition(position: number, width: number): number {
  if (width <= 0 || (position >= width * .5 && position < width * 2)) return position;
  return width + phase(position, width);
}

export function resizeStripPosition(position: number, previousWidth: number, width: number): number {
  if (width <= 0) return position;
  return previousWidth > 0 ? width * (1 + phase(position, previousWidth) / previousWidth) : width;
}
