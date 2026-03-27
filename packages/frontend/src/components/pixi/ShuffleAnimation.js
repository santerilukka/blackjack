import { Container } from 'pixi.js';
import { createCardSprite } from './CardSprite.js';
import { tween, easeOutCubic, easeOutQuad, easeInOutQuad, easeOutBounce } from './tween.js';
import { play } from '../../audio/SoundManager.js';

/** Shoe and discard positions (must match TableScene LAYOUT) */
const SHOE = { x: 1460, y: 100 };
const DISCARD = { x: 140, y: 100 };
/** Center of the table — where the shuffle animation plays */
const CENTER = { x: 800, y: 400 };
const CARD_HEIGHT = 116;

/**
 * Create N card-back sprites at (x, y) with alpha 0.
 * @param {number} n
 * @param {number} x
 * @param {number} y
 * @returns {Promise<import('pixi.js').Sprite[]>}
 */
async function makeCards(n, x, y) {
  const cards = [];
  for (let i = 0; i < n; i++) {
    const card = await createCardSprite(null, { height: CARD_HEIGHT });
    card.x = x;
    card.y = y;
    card.alpha = 0;
    cards.push(card);
  }
  return cards;
}

/**
 * Small helper to wait a fixed duration.
 * @param {number} ms
 */
function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Phase A: Fly cards from discard pile to table center.
 */
async function phaseCollect(container, app) {
  const COUNT = 6;
  const cards = await makeCards(COUNT, DISCARD.x, DISCARD.y);
  cards.forEach(c => { c.alpha = 1; container.addChild(c); });

  for (let i = 0; i < COUNT; i++) {
    const card = cards[i];
    // Stagger start
    if (i > 0) await wait(80);
    // Arc flight to center
    const fly = tween(card, { x: CENTER.x, y: CENTER.y }, 400, app, { easing: easeOutCubic });
    // Don't await last card — let them overlap slightly
    if (i < COUNT - 1) {
      fly.then(() => { card.alpha = 0; });
    } else {
      await fly;
      card.alpha = 0;
    }
  }
  // Brief pause after collect
  await wait(150);
  // Remove collect sprites
  cards.forEach(c => container.removeChild(c));
}

/**
 * Phase B: Gather — messy pile forms into neat stack at table center.
 */
async function phaseGather(cards, app) {
  // Start with random offsets (messy pile)
  for (const card of cards) {
    card.x = CENTER.x + (Math.random() - 0.5) * 50;
    card.y = CENTER.y + (Math.random() - 0.5) * 30;
    card.rotation = (Math.random() - 0.5) * 0.3;
    card.alpha = 1;
  }

  // Tween all to neat positions
  const tweens = cards.map((card, i) => {
    const offset = (i - (cards.length - 1) / 2) * 3;
    return tween(card, {
      x: CENTER.x + offset,
      y: CENTER.y - offset,
      rotation: 0,
    }, 400, app, { easing: easeOutQuad });
  });
  await Promise.all(tweens);
}

/**
 * Phase C: Riffle — split stack left/right, interleave back.
 */
async function phaseRiffle(cards, app) {
  const half = Math.floor(cards.length / 2);
  const left = cards.slice(0, half);
  const right = cards.slice(half);
  const SPREAD = 50;

  // Split apart
  const splitTweens = [
    ...left.map(c => tween(c, { x: c.x - SPREAD }, 250, app, { easing: easeOutQuad })),
    ...right.map(c => tween(c, { x: c.x + SPREAD }, 250, app, { easing: easeOutQuad })),
  ];
  await Promise.all(splitTweens);

  // Interleave back to center with staggered timing
  const merged = [];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (i < left.length) merged.push(left[i]);
    if (i < right.length) merged.push(right[i]);
  }

  const interleavePromises = merged.map((card, i) => {
    const targetOffset = (i - (merged.length - 1) / 2) * 3;
    return new Promise(resolve => {
      setTimeout(async () => {
        await tween(card, {
          x: CENTER.x + targetOffset,
          y: CENTER.y - targetOffset,
        }, 200, app, { easing: easeInOutQuad });
        resolve();
      }, i * 40);
    });
  });
  await Promise.all(interleavePromises);
}

/**
 * Phase D: Cut — top half lifts and swaps with bottom half.
 */
async function phaseCut(cards, app) {
  const half = Math.floor(cards.length / 2);
  const top = cards.slice(0, half);
  const bottom = cards.slice(half);

  // Lift top half up
  await Promise.all(
    top.map(c => tween(c, { y: c.y - 30 }, 200, app, { easing: easeOutQuad }))
  );

  // Slide bottom right and top left, then merge
  await Promise.all([
    ...bottom.map(c => tween(c, { y: c.y - 15 }, 200, app, { easing: easeInOutQuad })),
    ...top.map(c => tween(c, { y: c.y + 15 }, 200, app, { easing: easeInOutQuad })),
  ]);

  // Settle all back to stack
  const allCards = [...bottom, ...top];
  await Promise.all(
    allCards.map((card, i) => {
      const offset = (i - (allCards.length - 1) / 2) * 3;
      return tween(card, {
        x: CENTER.x + offset,
        y: CENTER.y - offset,
      }, 200, app, { easing: easeOutQuad });
    })
  );
}

/**
 * Phase E: Settle — converge to center, bounce, then fly to shoe.
 */
async function phaseSettle(cards, app) {
  // Converge all cards to exact center
  await Promise.all(
    cards.map(c => tween(c, { x: CENTER.x, y: CENTER.y }, 200, app, { easing: easeOutCubic }))
  );

  // Scale bounce on all cards together
  await Promise.all(
    cards.map(c => tween(c, { scaleX: 1.1, scaleY: 1.1 }, 150, app, { easing: easeOutQuad }))
  );
  await Promise.all(
    cards.map(c => tween(c, { scaleX: 1.0, scaleY: 1.0 }, 200, app, { easing: easeOutBounce }))
  );

  // Fly the stack from center to the shoe position
  await Promise.all(
    cards.map(c => tween(c, { x: SHOE.x, y: SHOE.y }, 400, app, { easing: easeInOutQuad }))
  );
}

/**
 * Play a casino-style shuffle animation.
 * @param {object} params
 * @param {import('pixi.js').Application} params.app - PixiJS application (for ticker)
 * @param {import('pixi.js').Container} params.root - Root stage container
 * @param {boolean} [params.showCollect=false] - Whether to animate discard-to-shoe collection
 * @returns {Promise<void>} Resolves when animation completes
 */
export async function playShuffleAnimation({ app, root, showCollect = false }) {
  const container = new Container();
  root.addChild(container);

  try {
    // Phase A: Collect from discard (mid-game reshuffle only)
    if (showCollect) {
      play('cardFan');
      await phaseCollect(container, app);
    }

    // Create the main stack of cards for shuffle phases
    const STACK_SIZE = 8;
    const stackCards = await makeCards(STACK_SIZE, CENTER.x, CENTER.y);
    stackCards.forEach(c => container.addChild(c));

    // Phase B: Gather into neat stack
    play('cardShuffle');
    await phaseGather(stackCards, app);

    // Phase C: Riffle x2
    play('cardFan');
    await phaseRiffle(stackCards, app);
    play('cardFan');
    await phaseRiffle(stackCards, app);

    // Phase D: Cut
    play('cardPlace');
    await phaseCut(stackCards, app);

    // Phase E: Settle + fly to shoe
    await phaseSettle(stackCards, app);
  } finally {
    // Cleanup
    container.destroy({ children: true });
  }
}
