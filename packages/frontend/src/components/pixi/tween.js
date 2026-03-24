/**
 * Built-in easing functions.
 */
export function linear(t) {
  return t;
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * General-purpose tween that interpolates numeric properties on any object
 * using the PixiJS application ticker.
 *
 * Supports special keys `scaleX` and `scaleY` which map to `target.scale.x`
 * and `target.scale.y` respectively.
 *
 * @param {object} target - The PixiJS display object to animate
 * @param {Record<string, number>} props - Target property values
 * @param {number} duration - Duration in milliseconds
 * @param {import('pixi.js').Application} app - PixiJS application (for ticker)
 * @param {{ easing?: (t: number) => number }} [options]
 * @returns {Promise<void>} Resolves when the tween completes
 */
export function tween(target, props, duration, app, { easing = linear } = {}) {
  return new Promise((resolve) => {
    // Capture start values
    const starts = {};
    for (const key of Object.keys(props)) {
      starts[key] = _get(target, key);
    }

    let elapsed = 0;

    const tick = (ticker) => {
      elapsed += ticker.deltaMS;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);

      for (const key of Object.keys(props)) {
        const start = starts[key];
        const end = props[key];
        _set(target, key, start + (end - start) * easedProgress);
      }

      if (progress >= 1) {
        // Ensure exact final values
        for (const key of Object.keys(props)) {
          _set(target, key, props[key]);
        }
        app.ticker.remove(tick);
        resolve();
      }
    };

    app.ticker.add(tick);
  });
}

/** @param {object} target @param {string} key */
function _get(target, key) {
  if (key === 'scaleX') return target.scale.x;
  if (key === 'scaleY') return target.scale.y;
  return target[key];
}

/** @param {object} target @param {string} key @param {number} value */
function _set(target, key, value) {
  if (key === 'scaleX') { target.scale.x = value; return; }
  if (key === 'scaleY') { target.scale.y = value; return; }
  target[key] = value;
}
