import { Container, Graphics, Text } from 'pixi.js';
import { createTopChipSprite, decomposeIntoChips } from './ChipSprite.js';
import { easeOutQuad, easeOutBounce } from './tween.js';

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

      // Shadow centered in wrapper
      const shadow = new Graphics();
      shadow.ellipse(2, 3, CHIP_SIZE / 2 - 2, CHIP_SIZE / 2 - 8);
      shadow.fill({ color: 0x000000, alpha: 0.25 });
      shadow.alpha = 0;
      wrapper.addChild(shadow);

      // Chip sprite centered in wrapper
      const sprite = createTopChipSprite(denomination, { size: CHIP_SIZE });
      wrapper.addChild(sprite);

      this._chipWrappers.push(wrapper);

      // --- Flung-from-HUD animation ---
      const finalX = xOff;
      const finalY = yOff;
      const startX = finalX + (Math.random() - 0.5) * 160;
      const startY = finalY + 350;
      const startRot = Math.random() * Math.PI * 2;
      const totalSpin = (1 + Math.random() * 2) * Math.PI * 2; // 1-3 full spins
      const finalRot = rot;
      const arcHeight = -60 - Math.random() * 20; // arc peak offset

      wrapper.x = startX;
      wrapper.y = startY;
      wrapper.alpha = 0;
      wrapper.scale.set(0.5);
      sprite.rotation = startRot;

      this.container.addChild(wrapper);

      // Phase 1: Flight with arc (250ms)
      const flightDuration = 250;
      await new Promise((resolve) => {
        let elapsed = 0;
        const tick = (ticker) => {
          elapsed += ticker.deltaMS;
          const progress = Math.min(elapsed / flightDuration, 1);
          const eased = easeOutQuad(progress);

          // Linear x interpolation
          wrapper.x = startX + (finalX - startX) * eased;

          // Y with parabolic arc: arc peaks at progress=0.5
          const linearY = startY + (finalY - startY) * eased;
          const arcOffset = arcHeight * 4 * progress * (1 - progress);
          wrapper.y = linearY + arcOffset;

          // Scale: grow from 0.5 to 1.0
          const s = 0.5 + 0.5 * eased;
          wrapper.scale.set(s);

          // Alpha: fast fade-in over first 20%
          wrapper.alpha = Math.min(progress / 0.2, 1);

          // Rotation: spin during flight
          sprite.rotation = startRot + totalSpin * eased;

          // Shadow fades in during second half of flight
          shadow.alpha = Math.max(0, (progress - 0.5) * 2) * 0.25;

          if (progress >= 1) {
            wrapper.x = finalX;
            wrapper.y = finalY;
            wrapper.scale.set(1);
            wrapper.alpha = 1;
            sprite.rotation = startRot + totalSpin;
            shadow.alpha = 0.25;
            app.ticker.remove(tick);
            resolve();
          }
        };
        app.ticker.add(tick);
      });

      // Snap rotation to final resting value
      sprite.rotation = finalRot;

      // Phase 2: Landing settle — squash & bounce (150ms)
      const landDuration = 150;
      await new Promise((resolve) => {
        let elapsed = 0;
        const baseY = finalY;
        const tick = (ticker) => {
          elapsed += ticker.deltaMS;
          const progress = Math.min(elapsed / landDuration, 1);
          const bounce = easeOutBounce(progress);

          // Squash/stretch: starts squashed, settles to 1.0
          const squash = 1 + (1 - bounce) * 0.08;
          const stretch = 1 - (1 - bounce) * 0.06;
          wrapper.scale.set(squash, stretch);

          // Slight y bounce
          wrapper.y = baseY - (1 - bounce) * 4;

          if (progress >= 1) {
            wrapper.scale.set(1);
            wrapper.y = finalY;
            app.ticker.remove(tick);
            resolve();
          }
        };
        app.ticker.add(tick);
      });
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
