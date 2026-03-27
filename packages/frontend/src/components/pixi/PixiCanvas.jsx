import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { PHASES, OUTCOMES, SHOP_ITEMS } from '@blackjack/shared';
import { usePixiApp } from '../../hooks/usePixiApp.js';
import { TableScene } from './TableScene.js';

const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 900;

/** Map outcome to overlay display text. Returns null for outcomes with no text overlay. */
function overlayText(outcome) {
  switch (outcome) {
    case OUTCOMES.WIN: return 'WIN';
    case OUTCOMES.BLACKJACK: return 'BLACKJACK!';
    case OUTCOMES.PUSH: return 'PUSH';
    case OUTCOMES.SURRENDER: return 'SURRENDER';
    default: return null;
  }
}

/**
 * React wrapper that hosts the PixiJS canvas.
 * Receives gameState and syncs the TableScene whenever it changes.
 *
 * The PixiJS coordinate system is always 1600x900. Responsive scaling is handled
 * via CSS transform on the wrapper div, driven by a ResizeObserver on the parent.
 *
 * Exposes imperative methods for bet chip placement via forwardRef.
 * Never import PixiJS directly in other React components — use this bridge.
 */
const PixiCanvas = forwardRef(function PixiCanvas({ gameState, npcCount = 0, onAnimatingChange, activeFelt }, ref) {
  const { canvasRef, app, ready } = usePixiApp({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
  const sceneRef = useRef(null);
  const parentRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [sceneReady, setSceneReady] = useState(false);
  const [resultOverlay, setResultOverlay] = useState(null);
  const onAnimatingChangeRef = useRef(onAnimatingChange);
  const shuffleAnimatedRef = useRef(false);

  // Expose imperative bet chip methods to parent
  useImperativeHandle(ref, () => ({
    addBetChip: (denom) => sceneRef.current?.addBetChip(denom),
    clearBetChips: () => sceneRef.current?.clearBetChips(),
  }), []);

  // Responsive scaling via ResizeObserver on the parent element
  useEffect(() => {
    const parent = parentRef.current?.parentElement;
    if (!parent) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: pw, height: ph } = entry.contentRect;
        setScale(Math.min(pw / CANVAS_WIDTH, ph / CANVAS_HEIGHT));
      }
    });

    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  // Keep callback ref current without re-creating the scene
  useEffect(() => {
    onAnimatingChangeRef.current = onAnimatingChange;
  }, [onAnimatingChange]);

  // Create the TableScene once the app is ready
  useEffect(() => {
    if (!ready || !app) return;

    const scene = new TableScene(app, { npcCount });
    scene.animationQueue.onBusyChange = (busy) => {
      onAnimatingChangeRef.current?.(busy);
    };
    scene.onResultOverlay = (overlay) => setResultOverlay(overlay);
    sceneRef.current = scene;
    setSceneReady(true);

    return () => {
      scene.destroy();
      sceneRef.current = null;
      setSceneReady(false);
    };
  }, [ready, app, npcCount]);

  // Apply felt color cosmetic
  useEffect(() => {
    if (!sceneReady || !sceneRef.current || !activeFelt) return;
    const item = SHOP_ITEMS[activeFelt];
    if (item) {
      sceneRef.current.applyFeltColors(item.colors);
    }
  }, [activeFelt, sceneReady]);

  // Sync game state into the scene
  useEffect(() => {
    if (!sceneReady || !sceneRef.current || !gameState) return;

    // Clear the scene when returning to betting phase (new round)
    if (gameState.phase === PHASES.BETTING && gameState.playerHand.cards.length === 0) {
      if (gameState.reshuffled && !shuffleAnimatedRef.current) {
        shuffleAnimatedRef.current = true;
        const showCollect = (sceneRef.current._discardCount || 0) > 0;
        // Clear without updating stacks so shoe appears unchanged during animation
        sceneRef.current.clear();
        sceneRef.current.playShuffle({ showCollect }).then(() => {
          sceneRef.current._updateStacksInternal(gameState.shoeSize, 0);
        });
        return;
      }
      shuffleAnimatedRef.current = false;
      sceneRef.current.clear(gameState.shoeSize);
      return;
    }

    shuffleAnimatedRef.current = false;
    sceneRef.current.update(gameState);
  }, [gameState, sceneReady]);

  const text = resultOverlay?.show ? overlayText(resultOverlay.outcome) : null;
  const isWinOutcome = resultOverlay?.outcome === OUTCOMES.WIN || resultOverlay?.outcome === OUTCOMES.BLACKJACK;
  const netProfit = (resultOverlay?.payout != null && resultOverlay?.totalBet)
    ? resultOverlay.payout - resultOverlay.totalBet
    : 0;
  const showTotalWon = text && isWinOutcome && netProfit > 0;
  let wonTier = 'small';
  if (showTotalWon && resultOverlay.totalBet > 0) {
    const multiplier = resultOverlay.payout / resultOverlay.totalBet;
    if (multiplier >= 5) wonTier = 'large';
    else if (multiplier >= 2) wonTier = 'medium';
  }

  return (
    <div ref={parentRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={canvasRef}
        className="pixi-canvas-wrapper"
        style={{
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${scale})`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {text && (
          <div
            key={resultOverlay.outcome}
            className={`result-overlay result-overlay--${resultOverlay.outcome}`}
          >
            <div>{text}</div>
            {showTotalWon && (
              <div className={`result-overlay__total result-overlay__total--${wonTier}`}>
                +${netProfit}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default PixiCanvas;
