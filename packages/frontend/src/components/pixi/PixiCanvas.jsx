import { useEffect, useRef } from 'react';
import { usePixiApp } from '../../hooks/usePixiApp.js';
import { TableScene } from './TableScene.js';

/**
 * React wrapper that hosts the PixiJS canvas.
 * Receives gameState and syncs the TableScene whenever it changes.
 *
 * Never import PixiJS directly in other React components — use this bridge.
 */
export default function PixiCanvas({ gameState, width = 800, height = 500 }) {
  const { canvasRef, app, ready } = usePixiApp({ width, height });
  const sceneRef = useRef(null);

  // Create the TableScene once the app is ready
  useEffect(() => {
    if (!ready || !app) return;

    const scene = new TableScene(app);
    sceneRef.current = scene;

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, [ready, app]);

  // Sync game state into the scene
  useEffect(() => {
    if (!sceneRef.current || !gameState) return;

    // Clear the scene when returning to betting phase (new round)
    if (gameState.phase === 'betting' && gameState.playerHand.cards.length === 0) {
      sceneRef.current.clear();
      return;
    }

    sceneRef.current.update(gameState);
  }, [gameState]);

  return (
    <div
      ref={canvasRef}
      className="pixi-canvas-wrapper"
      style={{ width, height, margin: '0 auto', borderRadius: 12, overflow: 'hidden' }}
    />
  );
}
