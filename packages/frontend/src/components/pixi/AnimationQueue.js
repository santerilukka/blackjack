/**
 * Manages a sequential queue of animations.
 * Each animation is a function that returns a Promise (resolved when the animation finishes).
 * The queue processes one animation at a time and signals when idle.
 */
export class AnimationQueue {
  constructor() {
    /** @type {Array<() => Promise<void>>} */
    this._queue = [];
    this._running = false;
    /** @type {(() => void) | null} */
    this.onIdle = null;
    /** @type {((busy: boolean) => void) | null} */
    this.onBusyChange = null;
  }

  /** @returns {boolean} */
  get busy() {
    return this._running || this._queue.length > 0;
  }

  /**
   * Enqueue an animation function.
   * @param {() => Promise<void>} animFn
   */
  enqueue(animFn) {
    this._queue.push(animFn);
    if (!this._running) {
      this._flush();
    }
  }

  /** Process queued animations sequentially. */
  async _flush() {
    this._running = true;
    this.onBusyChange?.(true);
    while (this._queue.length > 0) {
      const fn = this._queue.shift();
      await fn();
    }
    this._running = false;
    this.onBusyChange?.(false);
    this.onIdle?.();
  }

  /** Clear all pending (not-yet-started) animations. */
  clear() {
    this._queue.length = 0;
  }
}
