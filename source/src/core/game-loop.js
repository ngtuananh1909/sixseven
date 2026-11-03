/** One requestAnimationFrame loop for all modes, with tab-aware pauses. */
export class GameLoop {
  constructor(engine, video) {
    this.engine = engine; this.video = video; this.game = null;
    this.last = performance.now(); this.paused = document.hidden; this.pauseAt = this.last;
    this.frame = this.frame.bind(this);
    document.addEventListener('visibilitychange', () => this.setPause(document.hidden));
    requestAnimationFrame(this.frame);
  }
  mount(game) { this.game = game; this.engine.reset(); this.last = performance.now(); if (this.paused) game?.onPause?.(this.last); }
  unmount() { this.game = null; this.engine.deactivate(); }
  setPause(paused) {
    if (this.paused === paused) return;
    this.paused = paused;
    const now = performance.now();
    if (paused) { this.pauseAt = now; this.game?.onPause?.(now); }
    else { this.game?.onResume?.(now, now - this.pauseAt); this.last = now; this.engine.reset(); }
  }
  frame(now) {
    requestAnimationFrame(this.frame);
    if (this.paused || !this.game) { this.last = now; return; }
    const dt = Math.min(100, Math.max(0, now - this.last)); this.last = now;
    const data = this.engine.detect(this.video, now);
    this.game.update(now, dt, data);
  }
}
