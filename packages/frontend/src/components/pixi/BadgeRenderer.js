import { Container, Graphics, Text } from 'pixi.js';
import { GOLD, GOLD_BORDER, BUST_RED } from '../../theme/colors.js';

/**
 * Create a pill-shaped hand total badge (per spec Section 3.5).
 * @param {number} x @param {number} y
 * @returns {Container}
 */
export function createTotalBadge(x, y) {
  const container = new Container();
  container.x = x;
  container.y = y;

  const bg = new Graphics();
  container._bg = bg;
  container.addChild(bg);

  const label = new Text({
    text: '',
    style: {
      fill: GOLD,
      fontSize: 26,
      fontFamily: 'sans-serif',
      fontWeight: 'bold',
    },
  });
  label.anchor = { x: 0.5, y: 0.5 };
  container._label = label;
  container.addChild(label);

  container.visible = false;
  return container;
}

/**
 * Redraw a total badge pill background to fit the current text.
 * @param {Container} badge
 */
export function updateBadge(badge) {
  const label = badge._label;
  const bg = badge._bg;
  bg.clear();

  if (!label.text) {
    badge.visible = false;
    return;
  }

  badge.visible = true;
  const padX = 10;
  const padY = 3;
  const w = label.width + padX * 2;
  const h = label.height + padY * 2;

  bg.roundRect(-w / 2, -h / 2, w, h, 10);
  bg.fill('rgba(0, 0, 0, 0.60)');
  bg.roundRect(-w / 2, -h / 2, w, h, 10);
  bg.stroke({ color: GOLD_BORDER, width: 1 });

  // Color bust text red
  if (label.text === 'BUST') {
    label.style.fill = BUST_RED;
  } else {
    label.style.fill = GOLD;
  }
}
