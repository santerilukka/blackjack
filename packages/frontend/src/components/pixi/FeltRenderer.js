import { Graphics, Text } from 'pixi.js';
import { LAYOUT } from './tableLayout.js';
import { BG_DARK, GOLD_30 } from '../../theme/colors.js';

/**
 * Renders the semicircular table felt, decorative text, and betting circles.
 * Extracted from TableScene for focused responsibility.
 */
export class FeltRenderer {
  /**
   * @param {import('pixi.js').Container} root - The root container to draw into
   * @param {import('pixi.js').Application} app
   */
  constructor(root, app) {
    this._root = root;
    this._app = app;
    this._feltColors = { fill: '#1a5c2a', rim: '#0d3318', bg: BG_DARK };
    this._feltGraphics = [];
  }

  /** @returns {{ fill: string, rim: string, bg: string }} */
  get colors() {
    return this._feltColors;
  }

  /**
   * Draw the full felt (background, fill, rim, gold line, text, betting circles).
   */
  draw() {
    // Remove previous felt graphics if redrawing
    for (const obj of this._feltGraphics) {
      this._root.removeChild(obj);
      obj.destroy({ children: true });
    }
    this._feltGraphics = [];

    const { cx, topY, rx } = LAYOUT.table;
    const W = this._app.screen.width;
    const H = this._app.screen.height;
    const { fill, rim: rimColor, bg: bgColor } = this._feltColors;

    // --- Background outside felt ---
    const bg = new Graphics();
    bg.rect(0, 0, W, H);
    bg.fill(bgColor);
    this._root.addChildAt(bg, 0);
    this._feltGraphics.push(bg);

    // --- Felt fill ---
    const felt = new Graphics();
    this._traceFeltPath(felt, cx, topY, rx);
    felt.fill(fill);
    this._root.addChildAt(felt, 1);
    this._feltGraphics.push(felt);

    // --- Outer rim stroke (simulates wooden rail) ---
    const rim = new Graphics();
    this._traceFeltPath(rim, cx, topY, rx);
    rim.stroke({ color: rimColor, width: 6 });
    this._root.addChildAt(rim, 2);
    this._feltGraphics.push(rim);

    // --- Inner gold decorative line (inset 14px) ---
    const inset = 14;
    const gold = new Graphics();
    this._traceFeltPath(gold, cx, topY + inset, rx - inset);
    gold.stroke({ color: 'rgba(255, 215, 0, 0.35)', width: 2 });
    this._root.addChildAt(gold, 3);
    this._feltGraphics.push(gold);

    // --- Printed text on felt ---
    const bjText = new Text({
      text: 'BLACKJACK PAYS 3 TO 2',
      style: {
        fill: GOLD_30,
        fontSize: 26,
        fontFamily: 'Georgia, serif',
        fontWeight: 'bold',
        letterSpacing: 4,
      },
    });
    bjText.anchor = { x: 0.5, y: 0.5 };
    bjText.x = cx;
    bjText.y = 155;
    this._root.addChildAt(bjText, 4);
    this._feltGraphics.push(bjText);

    const insText = new Text({
      text: 'INSURANCE PAYS 2 TO 1',
      style: {
        fill: 'rgba(255, 215, 0, 0.22)',
        fontSize: 18,
        fontFamily: 'Georgia, serif',
        fontWeight: 'bold',
        letterSpacing: 3,
      },
    });
    insText.anchor = { x: 0.5, y: 0.5 };
    insText.x = cx;
    insText.y = 300;
    this._root.addChildAt(insText, 5);
    this._feltGraphics.push(insText);

    const dealerText = new Text({
      text: 'DEALER',
      style: {
        fill: 'rgba(255, 255, 255, 0.20)',
        fontSize: 18,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        letterSpacing: 5,
      },
    });
    dealerText.anchor = { x: 0.5, y: 0.5 };
    dealerText.x = cx;
    dealerText.y = 85;
    this._root.addChildAt(dealerText, 6);
    this._feltGraphics.push(dealerText);

    // --- 7 Betting circle markings along the arc ---
    const circleGraphics = this._drawBettingCircles();
    this._feltGraphics.push(circleGraphics);
  }

  /**
   * Apply a new felt color theme and redraw.
   * @param {{ fill: string, rim: string, bg: string }} colors
   */
  applyColors(colors) {
    this._feltColors = { ...colors };
    this.draw();
  }

  /**
   * Trace a semicircular table path: flat edge at top, arc curving down.
   */
  _traceFeltPath(g, cx, topY, r) {
    g.moveTo(cx - r, topY);
    g.lineTo(cx + r, topY);
    g.arc(cx, topY, r, 0, Math.PI);
    g.closePath();
  }

  /**
   * Draw the 7 decorative betting circles along the player arc.
   * @returns {Graphics}
   */
  _drawBettingCircles() {
    const { cx, cy, rx } = LAYOUT.seats;
    const angles = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(f => f * Math.PI);

    const seats = angles.map((a, i) => ({
      x: Math.round(cx + rx * Math.cos(a)),
      y: Math.round(cy + rx * Math.sin(a)),
      isPlayer: i === 3,
    }));

    const g = new Graphics();
    for (const seat of seats) {
      const color = seat.isPlayer
        ? 'rgba(255, 215, 0, 0.55)'
        : 'rgba(255, 215, 0, 0.25)';
      const width = seat.isPlayer ? 2.5 : 2;

      g.circle(seat.x, seat.y, 42);
      g.stroke({ color, width });
      g.circle(seat.x, seat.y, 32);
      g.stroke({ color, width: 1 });
    }
    this._root.addChildAt(g, 7);
    return g;
  }
}
