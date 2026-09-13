// Kept independent of React and the browser so cancellation/timing can be tested.
export class PhotoGesture {
  private x = 0;
  private y = 0;
  private touch = false;
  private consumed = false;
  private active = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  start(x: number, y: number, touch: boolean, onHold: () => void) {
    this.finish();
    this.x = x; this.y = y; this.touch = touch; this.consumed = false; this.active = true;
    if (touch) this.timer = setTimeout(() => {
      this.consumed = true; this.active = false; this.timer = null; onHold();
    }, 450);
  }

  move(x: number, y: number) {
    if (!this.active || Math.hypot(x - this.x, y - this.y) <= 8) return false;
    this.cancel(); return true;
  }

  finish() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null; this.active = false;
  }

  release(): "metadata" | "none" {
    const tap = this.active && this.touch && !this.consumed;
    this.finish();
    if (this.touch) this.consumed = true;
    return tap ? "metadata" : "none";
  }

  cancel() { this.consumed = true; this.finish(); }

  leave() {
    // Touch browsers can emit pointerleave after pointerup and before click.
    // Only cancel a press that is still in progress, not a completed short tap.
    if (this.active) this.cancel();
  }

  click(keyboard: boolean): "fullscreen" | "metadata" | "none" {
    if (keyboard) return "fullscreen";
    if (this.consumed) return "none";
    return this.touch ? "metadata" : "fullscreen";
  }
}
