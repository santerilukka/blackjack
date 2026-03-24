import { useEffect, useRef, useState, useCallback } from 'react';
import { PHASES } from '@blackjack/shared';
import { usePixiApp } from '../../hooks/usePixiApp.js';
import { TableScene } from './TableScene.js';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;

/**
 * React wrapper that hosts the PixiJS canvas.
 * Receives gameState and syncs the TableScene whenever it changes.
 *
 * The PixiJS coordinate system is always 800x500. Responsive scaling is handled
 * via CSS transform on the wrapper div, driven by a ResizeObserver on the parent.
 *
 * Never import PixiJS directly in other React components — use this bridge.
 */
export default function PixiCanvas({ gameState, npcCount = 0 }) {
  const { canvasRef, app, ready } = usePixiApp({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
  const sceneRef = useRef(null);
  const parentRef = useRef(null);
  const [scale, setScale] = useState(1);

  // Responsive scaling via ResizeObserver on the parent element
  useEffect(() => {
    const parent = parentRef.current?.parentElement;
    if (!parent) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const parentWidth = entry.contentRect.width;
        setScale(Math.min(parentWidth / CANVAS_WIDTH, 1.0));
      }
    });

    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  // Create the TableScene once the app is ready
  useEffect(() => {
    if (!ready || !app) return;

    const scene = new TableScene(app, { npcCount });
    sceneRef.current = scene;

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, [ready, app, npcCount]);

  // Sync game state into the scene
  useEffect(() => {
    if (!sceneRef.current || !gameState) return;

    // Clear the scene when returning to betting phase (new round)
    if (gameState.phase === PHASES.BETTING && gameState.playerHand.cards.length === 0) {
      sceneRef.current.clear(gameState.shoeSize);
      return;
    }

    sceneRef.current.update(gameState);
  }, [gameState]);

  return (
    <div ref={parentRef} style={{ width: '100%' }}>
      <div
        ref={canvasRef}
        className="pixi-canvas-wrapper"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          margin: '0 auto',
          borderRadius: 12,
          overflow: 'hidden',
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      />
    </div>
  );
}
