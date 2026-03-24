import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';

/**
 * Bridge hook that manages a PixiJS Application lifecycle.
 * Mounts the canvas into the provided container ref.
 *
 * @param {{ width?: number, height?: number, background?: string }} options
 * @returns {{ canvasRef: React.RefObject, app: Application | null, ready: boolean }}
 */
export function usePixiApp({ width = 800, height = 500, background = '#0a1f11' } = {}) {
  const canvasRef = useRef(null);
  const appRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const app = new Application();
    let destroyed = false;

    const initPromise = app.init({
      width,
      height,
      background,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      if (destroyed) return;
      appRef.current = app;
      canvasRef.current?.appendChild(app.canvas);
      setReady(true);
    });

    return () => {
      destroyed = true;
      setReady(false);
      appRef.current = null;
      // Wait for init to finish before destroying — calling destroy()
      // on an uninitialized Application throws in PixiJS v8.
      initPromise.then(() => app.destroy(true, { children: true }));
    };
  }, [width, height, background]);

  return { canvasRef, app: appRef.current, ready };
}
