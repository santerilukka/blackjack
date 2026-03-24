import { Container, Text } from 'pixi.js';
import { createCardSprite } from './CardSprite.js';

const STACK_CARD_HEIGHT = 100;
const STACK_LAYER_OFFSET = 3;
const STACK_MAX_LAYERS = 5;

/**
 * Renders a card-back stack (shoe or discard pile).
 * The container position is the visual center of the stack.
 */
export class StackRenderer {
  /**
   * @param {number} x - center X
   * @param {number} y - center Y
   */
  constructor(x, y) {
    this.container = new Container();
    this.container.x = x;
    this.container.y = y;

    this.label = new Text({ text: '', style: { fill: '#cccccc', fontSize: 18, fontFamily: 'sans-serif' } });
    this.label.anchor = { x: 0.5, y: 0 };
    this.label.x = x;
    this.label.y = y + STACK_CARD_HEIGHT / 2 + 8;

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
      // Cards have center anchor, so offset from center of stack
      card.x = (i - (layers - 1) / 2) * STACK_LAYER_OFFSET;
      card.y = ((layers - 1) / 2 - i) * STACK_LAYER_OFFSET;
      this.container.addChild(card);
    }
  }
}
