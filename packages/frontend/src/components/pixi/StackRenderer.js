import { Container, Text } from 'pixi.js';
import { createCardSprite } from './CardSprite.js';

const STACK_CARD_HEIGHT = 100;
const STACK_LAYER_OFFSET = 2;
const STACK_MAX_LAYERS = 5;

/**
 * Renders a card-back stack (shoe or discard pile).
 */
export class StackRenderer {
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} labelX - center X for the label
   * @param {number} labelY
   */
  constructor(x, y, labelX, labelY) {
    this.container = new Container();
    this.container.x = x;
    this.container.y = y;

    this.label = new Text({ text: '', style: { fill: '#cccccc', fontSize: 13, fontFamily: 'sans-serif' } });
    this.label.anchor = { x: 0.5, y: 0 };
    this.label.x = labelX;
    this.label.y = labelY;

    this._count = 0;
  }

  /**
   * Update the stack if the count changed.
   * @param {number} count
   * @param {string} labelText
   */
  async update(count, labelText) {
    this.label.text = labelText;
    if (count === this._count) return;
    this._count = count;
    await this._build(count);
  }

  /** @private */
  async _build(count) {
    this.container.removeChildren();
    if (count <= 0) return;

    const layers = Math.min(STACK_MAX_LAYERS, Math.max(1, Math.ceil(count / 60)));

    for (let i = 0; i < layers; i++) {
      const card = await createCardSprite(null, { height: STACK_CARD_HEIGHT });
      card.x = i * STACK_LAYER_OFFSET;
      card.y = (layers - 1 - i) * STACK_LAYER_OFFSET;
      this.container.addChild(card);
    }
  }
}
