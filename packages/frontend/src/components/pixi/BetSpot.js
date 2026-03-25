import { Container, Graphics, Text } from 'pixi.js';
import { createTopChipSprite, decomposeIntoChips } from './ChipSprite.js';
import { tween, easeOutCubic } from './tween.js';

const BET_CIRCLE_RADIUS = 45;
const CHIP_SIZE = 70;
const MAX_VISIBLE_CHIPS = 15;
const STACK_Y_OFFSET = 5;

/**
 * Renders the betting spot on the PixiJS table.
 * Supports both incremental chip placement (during betting) and
 * full redraw from amount (after API state sync).
 */
export class BetSpot {
  /** @param {number} x @param {number} y */
  constructor(x, y) {
    this.container = new Container();
    this.container.x = x;
    this.container.y = y;
    this._currentBet = 0;
    /** @type {Array<{ denom: number, xOff: number, yOff: number, rot: number }>} */
    this._chips = [];
    /** @type {Array<Container>} */
    this._chipWrappers = [];
    this._totalLabel = null;
    this._totalBg = null;
    this._drawEmpty();
  }

  get radius() { return BET_CIRCLE_RADIUS; }

  /**
   * Add a single chip with spin animation (used during betting phase).
   * @param {number} denomination
   * @param {import('pixi.js').Application} app
   * @returns {Promise<void>}
   */
  async addChip(denomination, app) {
    // If this is the first chip, remove the empty placeholder
    if (this._chips.length === 0) {
      this.container.removeChildren();
      this._totalLabel = null;
      this._totalBg = null;
    }

    const i = this._chips.length;
    const xOff = (Math.random() - 0.5) * 10;
    const yOff = -i * STACK_Y_OFFSET + (Math.random() - 0.5) * 3;
    const rot = (Math.random() - 0.5) * 0.15;

    this._chips.push({ denom: denomination, xOff, yOff, rot });
    this._currentBet += denomination;

    // Only show up to MAX_VISIBLE_CHIPS
    if (i < MAX_VISIBLE_CHIPS) {
      // Wrapper positioned at the final stack location
      const wrapper = new Container();
      wrapper.x = xOff;
      wrapper.y = yOff;

      // Shadow centered in wrapper
      const shadow = new Graphics();
      shadow.ellipse(2, 3, CHIP_SIZE / 2 - 2, CHIP_SIZE / 2 - 8);
      shadow.fill({ color: 0x000000, alpha: 0.25 });
      wrapper.addChild(shadow);

      // Chip sprite centered in wrapper
      const sprite = createTopChipSprite(denomination, { size: CHIP_SIZE });
      sprite.rotation = rot;
      wrapper.addChild(sprite);

      this._chipWrappers.push(wrapper);

      // Start off-screen below with small scale
      const finalX = wrapper.x;
      const finalY = wrapper.y;
      wrapper.x = finalX;
      wrapper.y = finalY + 200;
      wrapper.alpha = 0;
      wrapper.scale.set(0.3);

      this.container.addChild(wrapper);

      // Animate to final position (spin via scale flip, not rotation)
      await tween(wrapper, {
        y: finalY,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
      }, 300, app, { easing: easeOutCubic });
    }

    // Update total label
    this._updateTotalLabel();
  }

  /**
   * Remove all chips (used for "Clear Bets").
   */
  clearChips() {
    this._chips = [];
    this._chipWrappers = [];
    this._currentBet = 0;
    this._totalLabel = null;
    this._totalBg = null;
    this.container.removeChildren();
    this._drawEmpty();
  }

  /** @param {number} amount */
  update(amount) {
    if (amount === this._currentBet) return;
    this._currentBet = amount;
    this._chips = [];
    this._chipWrappers = [];
    this._totalLabel = null;
    this._totalBg = null;
    this.container.removeChildren();

    if (amount <= 0) {
      this._drawEmpty();
    } else {
      this._drawChipStack(amount);
    }
  }

  clear() {
    this._currentBet = 0;
    this._chips = [];
    this._chipWrappers = [];
    this._totalLabel = null;
    this._totalBg = null;
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

  /** Draw stacked chip sprites with shadows and a total label (full redraw). */
  _drawChipStack(amount) {
    const chips = decomposeIntoChips(amount);
    const visibleChips = chips.slice(0, MAX_VISIBLE_CHIPS);

    for (let i = 0; i < visibleChips.length; i++) {
      const denom = visibleChips[i];
      const xOff = (Math.random() - 0.5) * 10;
      const yOff = -i * STACK_Y_OFFSET + (Math.random() - 0.5) * 3;
      const rot = (Math.random() - 0.5) * 0.15;

      // Shadow
      const shadow = new Graphics();
      shadow.ellipse(xOff + 2, yOff + 3, CHIP_SIZE / 2 - 2, CHIP_SIZE / 2 - 8);
      shadow.fill({ color: 0x000000, alpha: 0.25 });
      this.container.addChild(shadow);

      // Chip sprite
      const sprite = createTopChipSprite(denom, { size: CHIP_SIZE });
      sprite.x = xOff;
      sprite.y = yOff;
      sprite.rotation = rot;
      this.container.addChild(sprite);
    }

    this._chips = chips.map((denom, i) => ({
      denom,
      xOff: (Math.random() - 0.5) * 10,
      yOff: -i * STACK_Y_OFFSET + (Math.random() - 0.5) * 3,
      rot: (Math.random() - 0.5) * 0.15,
    }));

    const labelY = CHIP_SIZE / 2 + 12;
    this._drawTotalLabel(amount, 0, labelY);
  }

  /** Update or create the total label to reflect current bet. */
  _updateTotalLabel() {
    if (this._totalBg) {
      this.container.removeChild(this._totalBg);
      this._totalBg = null;
    }
    if (this._totalLabel) {
      this.container.removeChild(this._totalLabel);
      this._totalLabel = null;
    }

    if (this._currentBet <= 0) return;

    const labelY = CHIP_SIZE / 2 + 12;
    this._drawTotalLabel(this._currentBet, 0, labelY);
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

    const padX = 10;
    const padY = 4;
    const w = label.width + padX * 2;
    const h = label.height + padY * 2;
    const bg = new Graphics();
    bg.roundRect(x - w / 2, y - h / 2, w, h, 10);
    bg.fill({ color: 0x000000, alpha: 0.6 });

    this.container.addChild(bg, label);
    this._totalBg = bg;
    this._totalLabel = label;
  }
}
