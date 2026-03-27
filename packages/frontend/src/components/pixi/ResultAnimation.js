import { Container, Graphics } from 'pixi.js';
import { tween, easeOutQuad, easeOutCubic } from './tween.js';
import { createTopChipSprite, decomposeIntoChips } from './ChipSprite.js';
import { OUTCOMES } from '@blackjack/shared';

const DEALER_X = 800;
const DEALER_Y = 220;
const PLAYER_COLLECT_X = 800;
const PLAYER_COLLECT_Y = 880;
const MAX_FLY_CHIPS = 10;

/**
 * Small helper to wait a fixed duration.
 * @param {number} ms
 */
function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Golden light rays radiating from the bet spot area.
 * Rays start offset from center and are shorter for a cleaner look.
 */
function goldenRays(container, app, cx, cy) {
  const RAY_COUNT = 12;
  const RAY_WIDTH = 6;
  const RAY_LENGTH = 150;
  const RAY_START_OFFSET = 40;
  const rays = [];

  for (let i = 0; i < RAY_COUNT; i++) {
    const ray = new Graphics();
    ray.rect(-RAY_WIDTH / 2, -(RAY_START_OFFSET + RAY_LENGTH), RAY_WIDTH, RAY_LENGTH);
    ray.fill({ color: 0xffd700, alpha: 0.5 });
    ray.x = cx;
    ray.y = cy;
    ray.rotation = (i / RAY_COUNT) * Math.PI * 2;
    ray.alpha = 0;
    ray.scale.y = 0.2;
    container.addChild(ray);
    rays.push(ray);
  }

  return new Promise((resolve) => {
    let elapsed = 0;
    const GROW_DURATION = 600;
    const HOLD_DURATION = 200;
    const FADE_DURATION = 400;
    const TOTAL = GROW_DURATION + HOLD_DURATION + FADE_DURATION;

    const tick = (ticker) => {
      elapsed += ticker.deltaMS;
      const t = Math.min(elapsed / TOTAL, 1);

      if (elapsed <= GROW_DURATION) {
        const growT = elapsed / GROW_DURATION;
        const eased = easeOutCubic(growT);
        for (const ray of rays) {
          ray.scale.y = 0.2 + 0.8 * eased;
          ray.alpha = 0.3 + 0.4 * Math.sin(growT * Math.PI);
        }
      } else if (elapsed <= GROW_DURATION + HOLD_DURATION) {
        const holdT = (elapsed - GROW_DURATION) / HOLD_DURATION;
        for (const ray of rays) {
          ray.alpha = 0.5 + 0.2 * Math.sin(holdT * Math.PI);
          ray.rotation += 0.002;
        }
      } else {
        const fadeT = (elapsed - GROW_DURATION - HOLD_DURATION) / FADE_DURATION;
        const fadeAlpha = Math.max(0, 0.5 * (1 - easeOutQuad(fadeT)));
        for (const ray of rays) {
          ray.alpha = fadeAlpha;
        }
      }

      for (const ray of rays) {
        ray.rotation += 0.003;
      }

      if (t >= 1) {
        app.ticker.remove(tick);
        resolve();
      }
    };

    app.ticker.add(tick);
  });
}

/**
 * Golden confetti burst from center, particles arc out with gravity.
 */
function confettiBurst(container, app, cx, cy) {
  const PARTICLE_COUNT = 35;
  const COLORS = [0xffd700, 0xffec80, 0xffffff, 0xff4444, 0x44ff44];
  const GRAVITY = 400; // px/s^2
  const DURATION = 1200;

  const particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const g = new Graphics();
    const w = 3 + Math.random() * 5;
    const h = 6 + Math.random() * 6;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    g.rect(-w / 2, -h / 2, w, h);
    g.fill({ color, alpha: 0.9 });
    g.x = cx;
    g.y = cy;
    g.alpha = 1;

    const angle = Math.random() * Math.PI * 2;
    const speed = 150 + Math.random() * 350;

    container.addChild(g);
    particles.push({
      sprite: g,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 200, // bias upward
      rotSpeed: (Math.random() - 0.5) * 8,
    });
  }

  return new Promise((resolve) => {
    let elapsed = 0;

    const tick = (ticker) => {
      elapsed += ticker.deltaMS;
      const dt = ticker.deltaMS / 1000;

      for (const p of particles) {
        p.vy += GRAVITY * dt;
        p.sprite.x += p.vx * dt;
        p.sprite.y += p.vy * dt;
        p.sprite.rotation += p.rotSpeed * dt;

        // Fade out particles near bottom or edges
        if (p.sprite.y > 850 || p.sprite.x < -50 || p.sprite.x > 1650) {
          p.sprite.alpha = Math.max(0, p.sprite.alpha - dt * 3);
        }
        // Fade all particles in the last 300ms
        if (elapsed > DURATION - 300) {
          const fadeT = (elapsed - (DURATION - 300)) / 300;
          p.sprite.alpha = Math.min(p.sprite.alpha, 1 - fadeT);
        }
      }

      if (elapsed >= DURATION) {
        app.ticker.remove(tick);
        resolve();
      }
    };

    app.ticker.add(tick);
  });
}

/**
 * Fly chip sprites from dealer area down to the player collect area (win animation).
 */
async function flyChipsFromDealer(container, app, winAmount) {
  if (winAmount <= 0) return;

  const chipDenoms = decomposeIntoChips(winAmount).slice(0, MAX_FLY_CHIPS);
  if (chipDenoms.length === 0) return;

  const wrappers = [];

  const promises = chipDenoms.map((denom, i) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const wrapper = new Container();
        const sprite = createTopChipSprite(denom, { size: 70 });
        wrapper.addChild(sprite);

        // Start at dealer area with slight random offset
        wrapper.x = DEALER_X + (Math.random() - 0.5) * 40;
        wrapper.y = DEALER_Y + (Math.random() - 0.5) * 20;
        wrapper.rotation = Math.random() * Math.PI * 2;
        wrapper.alpha = 0.8;

        container.addChild(wrapper);
        wrappers.push(wrapper);

        const finalRotation = (Math.random() - 0.5) * 0.3;

        Promise.all([
          tween(wrapper, {
            x: PLAYER_COLLECT_X + (Math.random() - 0.5) * 30,
            y: PLAYER_COLLECT_Y,
            alpha: 0,
            rotation: finalRotation + (Math.random() - 0.5) * 2,
          }, 900, app, { easing: easeOutQuad }),
        ]).then(resolve);
      }, i * 50);
    });
  });

  await Promise.all(promises);

  for (const w of wrappers) {
    w.destroy({ children: true });
  }
}

/**
 * Staggered tween of chip wrappers with rotation jitter.
 * Shared by sweep-to-dealer, collect-to-player, and surrender animations.
 * @param {Container[]} wrappers
 * @param {(wrapper: Container) => object} targetFn - produces tween target per wrapper
 * @param {import('pixi.js').Application} app
 * @param {{ staggerMs?: number, duration?: number }} [options]
 */
function staggeredChipTween(wrappers, targetFn, app, { staggerMs = 60, duration = 800 } = {}) {
  return Promise.all(wrappers.map((wrapper, i) =>
    new Promise((resolve) => {
      setTimeout(() => {
        tween(wrapper, targetFn(wrapper), duration, app, { easing: easeOutQuad }).then(resolve);
      }, i * staggerMs);
    })
  ));
}

/** Hide the bet label before chip animation. */
function hideBetLabel(betSpot) {
  if (betSpot._totalLabel) betSpot._totalLabel.alpha = 0;
  if (betSpot._totalBg) betSpot._totalBg.alpha = 0;
}

/**
 * Sweep all bet chips upward toward the dealer and fade out, with rotation.
 */
async function sweepChipsToDealer(betSpot, app) {
  const wrappers = betSpot._chipWrappers;
  if (!wrappers || wrappers.length === 0) { betSpot.clear(); return; }

  hideBetLabel(betSpot);
  await staggeredChipTween(wrappers, (w) => ({
    y: w.y - 400, alpha: 0, rotation: w.rotation + (Math.random() - 0.5) * 2,
  }), app);
  betSpot.clear();
}

/**
 * Collect bet chips downward to the player area and fade out.
 */
async function collectBetChipsToPlayer(betSpot, app) {
  const wrappers = betSpot._chipWrappers;
  if (!wrappers || wrappers.length === 0) { betSpot.clear(); return; }

  hideBetLabel(betSpot);
  await staggeredChipTween(wrappers, (w) => ({
    y: w.y + (PLAYER_COLLECT_Y - betSpot.container.y), alpha: 0, rotation: w.rotation + (Math.random() - 0.5) * 2,
  }), app);
  betSpot.clear();
}

/**
 * Surrender: sweep top half of chips to dealer, nudge bottom half back.
 */
async function surrenderChipSplit(betSpot, app) {
  const wrappers = betSpot._chipWrappers;
  if (!wrappers || wrappers.length === 0) { betSpot.clear(); return; }

  hideBetLabel(betSpot);
  const half = Math.ceil(wrappers.length / 2);

  await Promise.all([
    staggeredChipTween(wrappers.slice(0, half), (w) => ({
      y: w.y - 400, alpha: 0, rotation: w.rotation + (Math.random() - 0.5) * 2,
    }), app),
    staggeredChipTween(wrappers.slice(half), (w) => ({
      y: w.y + (PLAYER_COLLECT_Y - betSpot.container.y), alpha: 0, rotation: w.rotation + (Math.random() - 0.5) * 2,
    }), app),
  ]);
  betSpot.clear();
}

/**
 * Play per-hand animation for a single hand result.
 */
async function playHandAnimation(container, app, betSpot, handOutcome, winAmount) {
  const cx = betSpot.container.x;
  const cy = betSpot.container.y;

  switch (handOutcome) {
    case OUTCOMES.WIN:
      await wait(400);
      goldenRays(container, app, cx, cy - 80);
      await wait(400);
      await flyChipsFromDealer(container, app, winAmount);
      await collectBetChipsToPlayer(betSpot, app);
      break;
    case OUTCOMES.BLACKJACK:
      await wait(400);
      confettiBurst(container, app, cx, cy - 120);
      await wait(400);
      await flyChipsFromDealer(container, app, winAmount);
      await collectBetChipsToPlayer(betSpot, app);
      break;
    case OUTCOMES.LOSE:
      await wait(400);
      await sweepChipsToDealer(betSpot, app);
      await wait(200);
      break;
    case OUTCOMES.PUSH:
      await wait(200);
      await collectBetChipsToPlayer(betSpot, app);
      await wait(200);
      break;
    default:
      await wait(800);
  }
}

/**
 * Play the result animation for a given outcome.
 * @param {object} params
 * @param {import('pixi.js').Application} params.app
 * @param {import('pixi.js').Container} params.root
 * @param {string} params.outcome - One of OUTCOMES values
 * @param {import('./BetSpot.js').BetSpot} params.betSpot - Main bet spot
 * @param {Array<{betSpot: import('./BetSpot.js').BetSpot}>} [params.splitContainers] - Split hand containers
 * @param {boolean} [params.isSplit] - Whether in split mode
 * @param {Array<{outcome: string, payout: number, bet: number}>|null} [params.handResults] - Per-hand results for splits
 * @param {number|null} [params.payout] - Total payout for the round
 * @param {number} [params.totalBet] - Total bet for the round
 * @returns {Promise<void>}
 */
export async function playResultAnimation({ app, root, outcome, betSpot, splitContainers = [], isSplit = false, handResults = null, payout = null, totalBet = 0 }) {
  const container = new Container();
  root.addChild(container);

  try {
    // Split mode with per-hand results: animate each hand independently
    if (isSplit && handResults && handResults.length > 0) {
      const perHandPromises = handResults.map((hr, i) => {
        const sc = splitContainers[i];
        if (!sc?.betSpot) return Promise.resolve();
        const winAmount = hr.payout > hr.bet ? hr.payout - hr.bet : 0;
        return playHandAnimation(container, app, sc.betSpot, hr.outcome, winAmount);
      });
      await Promise.all(perHandPromises);
      return;
    }

    // Non-split (or legacy split without handResults): single animation
    const betSpots = isSplit
      ? splitContainers.filter(e => e?.betSpot).map(e => e.betSpot)
      : [betSpot];

    const cx = betSpot.container.x;
    const cy = betSpot.container.y;
    const winAmount = (payout != null && payout > totalBet) ? payout - totalBet : 0;

    switch (outcome) {
      case OUTCOMES.WIN: {
        await wait(400);
        goldenRays(container, app, cx, cy - 80);
        await wait(400);
        await flyChipsFromDealer(container, app, winAmount);
        await Promise.all(betSpots.map(bs => collectBetChipsToPlayer(bs, app)));
        break;
      }

      case OUTCOMES.BLACKJACK: {
        await wait(400);
        confettiBurst(container, app, cx, cy - 120);
        await wait(400);
        await flyChipsFromDealer(container, app, winAmount);
        await Promise.all(betSpots.map(bs => collectBetChipsToPlayer(bs, app)));
        break;
      }

      case OUTCOMES.LOSE: {
        await wait(400);
        await Promise.all(betSpots.map(bs => sweepChipsToDealer(bs, app)));
        await wait(200);
        break;
      }

      case OUTCOMES.PUSH: {
        await wait(200);
        await Promise.all(betSpots.map(bs => collectBetChipsToPlayer(bs, app)));
        await wait(200);
        break;
      }

      case OUTCOMES.SURRENDER: {
        await wait(200);
        await Promise.all(betSpots.map(bs => surrenderChipSplit(bs, app)));
        await wait(300);
        break;
      }

      default:
        await wait(800);
    }
  } finally {
    container.destroy({ children: true });
  }
}
