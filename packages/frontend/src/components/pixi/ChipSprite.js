import { Sprite, Assets } from 'pixi.js';

const DENOMINATIONS = [100, 50, 25, 10, 5];

/**
 * Build the public URL for a chip SVG asset.
 * @param {number} denomination
 * @returns {string}
 */
export function chipAssetPath(denomination) {
  return `/chips/chip${denomination}.svg`;
}

/**
 * Create a PixiJS Sprite for a chip of a given denomination.
 * Loads the SVG texture and sizes it.
 *
 * @param {number} denomination - One of 5, 10, 25, 50, 100
 * @param {{ size?: number }} [options]
 * @returns {Promise<Sprite>}
 */
export async function createChipSprite(denomination, { size = 40 } = {}) {
  const path = chipAssetPath(denomination);
  const texture = await Assets.load(path);
  const sprite = new Sprite(texture);

  const scale = size / Math.max(sprite.texture.width, sprite.texture.height);
  sprite.scale.set(scale);

  return sprite;
}

/**
 * Decompose an amount into chip denominations using a greedy largest-first approach.
 *
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
