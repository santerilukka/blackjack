import { Sprite, Assets } from 'pixi.js';
import { DENOMINATIONS, chipTopPath, chipFlatPath } from '../../utils/chipConfig.js';

/** @type {Map<string, import('pixi.js').Texture>} */
const textureCache = new Map();
let loaded = false;

/**
 * Preload all chip textures (top + flat for each denomination).
 * Call once at startup. Subsequent calls are a no-op.
 * @returns {Promise<void>}
 */
export async function loadChipTextures() {
  if (loaded) return;

  const paths = [];
  for (const denom of DENOMINATIONS) {
    paths.push(chipTopPath(denom));
    paths.push(chipFlatPath(denom));
  }

  await Promise.all(
    paths.map(async (p) => {
      const texture = await Assets.load(p);
      textureCache.set(p, texture);
    }),
  );

  loaded = true;
}

/**
 * Create a top-down chip Sprite for a denomination.
 * Textures must be preloaded via loadChipTextures() first.
 * @param {number} denomination
 * @param {{ size?: number }} [options]
 * @returns {Sprite}
 */
export function createTopChipSprite(denomination, { size = 60 } = {}) {
  const path = chipTopPath(denomination);
  const texture = textureCache.get(path);
  if (!texture) {
    console.warn(`Chip texture not loaded: ${path}`);
    return new Sprite();
  }

  const sprite = new Sprite(texture);
  const scale = size / Math.max(texture.width, texture.height);
  sprite.scale.set(scale);
  sprite.anchor.set(0.5);
  return sprite;
}

/**
 * Decompose an amount into chip denominations using a greedy largest-first approach.
 * @param {number} amount
 * @returns {number[]} Array of denominations (e.g. [50, 10, 5] for 65)
 */
export function decomposeIntoChips(amount) {
  const chips = [];
  let remaining = amount;

  for (const denom of DENOMINATIONS) {
    while (remaining >= denom) {
      chips.push(denom);
      remaining -= denom;
    }
  }

  return chips;
}
