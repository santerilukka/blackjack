import { Container, Graphics, Text } from 'pixi.js';

const BET_CIRCLE_RADIUS = 45;

/** Standard casino chip colours keyed by denomination */
const CHIP_COLORS = [
  { min: 100, fill: '#1a1a2e', stroke: '#e0e0e0', label: '#ffffff' },
  { min: 50,  fill: '#e67e22', stroke: '#f5c06d', label: '#ffffff' },
  { min: 25,  fill: '#27ae60', stroke: '#6dd5a0', label: '#ffffff' },
  { min: 10,  fill: '#2980b9', stroke: '#6db8e0', label: '#ffffff' },
  { min: 0,   fill: '#c0392b', stroke: '#e88a84', label: '#ffffff' },
];

/**
 * Renders the betting spot: empty circle when no bet, chip when active.
 */
export class BetSpot {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    this.container = new Container();
    this.container.x = x;
    this.container.y = y;
    this._currentBet = 0;
    this._draw(0);
  }

  /** @type {number} */
  get radius() { return BET_CIRCLE_RADIUS; }

  /**
   * Update the bet display if the amount changed.
   * @param {number} amount
   */
  update(amount) {
    if (amount === this._currentBet) return;
    this._currentBet = amount;
    this._draw(amount);
  }

  /** Reset to empty state. */
  clear() {
    this._currentBet = 0;
    this._draw(0);
  }

  /** @private */
  _draw(amount) {
    this.container.removeChildren();
    const g = new Graphics();

    if (amount <= 0) {
      g.circle(0, 0, BET_CIRCLE_RADIUS);
      g.stroke({ color: 'rgba(255,255,255,0.3)', width: 2 });
      const hint = new Text({
        text: 'BET',
        style: { fill: 'rgba(255,255,255,0.25)', fontSize: 18, fontFamily: 'sans-serif', fontWeight: 'bold' },
      });
      hint.anchor = { x: 0.5, y: 0.5 };
      this.container.addChild(g, hint);
      return;
    }

    const chipStyle = CHIP_COLORS.find(c => amount >= c.min) || CHIP_COLORS[CHIP_COLORS.length - 1];

    g.circle(0, 0, BET_CIRCLE_RADIUS);
    g.fill(chipStyle.fill);
    g.circle(0, 0, BET_CIRCLE_RADIUS);
    g.stroke({ color: chipStyle.stroke, width: 3 });
    g.circle(0, 0, BET_CIRCLE_RADIUS - 7);
    g.stroke({ color: chipStyle.stroke, width: 1 });
    this.container.addChild(g);

    const label = new Text({
      text: `$${amount}`,
      style: {
        fill: chipStyle.label,
        fontSize: amount >= 1000 ? 16 : 20,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
      },
    });
    label.anchor = { x: 0.5, y: 0.5 };
    this.container.addChild(label);
  }
}
