import { Container, Graphics, Text } from 'pixi.js';
import { createTopChipSprite, decomposeIntoChips } from './ChipSprite.js';

const BET_CIRCLE_RADIUS = 45;
const CHIP_SIZE = 70;
const MAX_VISIBLE_CHIPS = 8;
const STACK_Y_OFFSET = 4;

/**
 * Renders the betting spot on the PixiJS table.
 * Empty state: translucent circle with "BET" text.
 * Active state: stacked top-down chip sprites with shadow + total label.
 */
export class BetSpot {
  /** @param {number} x @param {number} y */
  constructor(x, y) {
    this.container = new Container();
    this.container.x = x;
    this.container.y = y;
    this._currentBet = 0;
    this._drawEmpty();
  }

  get radius() { return BET_CIRCLE_RADIUS; }

  /** @param {number} amount */
  update(amount) {
    if (amount === this._currentBet) return;
    this._currentBet = amount;
    this.container.removeChildren();

    if (amount <= 0) {
      this._drawEmpty();
    } else {
      this._drawChipStack(amount);
    }
  }

  clear() {
    this._currentBet = 0;
    this.container.removeChildren();
    this._drawEmpty();
  }

  /** Draw the empty bet circle placeholder. */
  _drawEmpty() {
    const g = new Graphics();
    g.circle(0, 0, BET_CIRCLE_RADIUS);
    g.stroke({ color: 'rgba(255,255,255,0.3)', width: 2 });

    const hint = new Text({
      text: 'BET',
      style: {
        fill: 'rgba(255,255,255,0.25)',
        fontSize: 18,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
      },
    });
    hint.anchor = { x: 0.5, y: 0.5 };
    this.container.addChild(g, hint);
  }

  /** Draw stacked chip sprites with shadows and a total label. */
  _drawChipStack(amount) {
    const chips = decomposeIntoChips(amount);
    const visibleChips = chips.slice(0, MAX_VISIBLE_CHIPS);

    // Draw chips from bottom to top
    for (let i = 0; i < visibleChips.length; i++) {
      const denom = visibleChips[i];
      const yOff = -i * STACK_Y_OFFSET;
      const xOff = i % 2 === 0 ? -1 : 1;

      // Shadow ellipse beneath chip
      const shadow = new Graphics();
      shadow.ellipse(xOff + 2, yOff + 3, CHIP_SIZE / 2 - 2, CHIP_SIZE / 2 - 8);
      shadow.fill({ color: 0x000000, alpha: 0.25 });
      this.container.addChild(shadow);

      // Chip sprite
      const sprite = createTopChipSprite(denom, { size: CHIP_SIZE });
      sprite.x = xOff;
      sprite.y = yOff;
      this.container.addChild(sprite);
    }

    // Total label below the stack
    const labelY = CHIP_SIZE / 2 + 12;
    this._drawTotalLabel(amount, 0, labelY);
  }

  /** Draw a pill-shaped total bet label. */
  _drawTotalLabel(amount, x, y) {
    const label = new Text({
      text: `$${amount}`,
      style: {
        fill: '#ffffff',
        fontSize: 18,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
      },
    });
    label.anchor = { x: 0.5, y: 0.5 };
    label.x = x;
    label.y = y;

    // Pill background
    const padX = 10;
    const padY = 4;
    const w = label.width + padX * 2;
    const h = label.height + padY * 2;
    const bg = new Graphics();
    bg.roundRect(x - w / 2, y - h / 2, w, h, 10);
    bg.fill({ color: 0x000000, alpha: 0.6 });

    this.container.addChild(bg, label);
  }
}
