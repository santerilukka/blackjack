import { Sprite, Assets } from 'pixi.js';

const SUIT_CODE = { hearts: 'H', diamonds: 'D', clubs: 'C', spades: 'S' };

function rankCode(rank) {
  return rank === '10' ? 'T' : rank;
}

/**
 * Build the public URL for a card SVG.
 * @param {{ rank: string, suit: string } | null} card  null = face-down card
 * @returns {string}
 */
export function cardAssetPath(card) {
  if (!card) return '/cards/1B.svg';
  return `/cards/${rankCode(card.rank)}${SUIT_CODE[card.suit]}.svg`;
}

/**
 * Create a PixiJS Sprite for a card.
 * Loads the texture from the card SVG asset, sizes it, and returns the sprite.
 *
 * @param {{ rank: string, suit: string } | null} card  null = face-down
 * @param {{ height?: number }} options
 * @returns {Promise<Sprite>}
 */
export async function createCardSprite(card, { height = 140 } = {}) {
  const path = cardAssetPath(card);
  const texture = await Assets.load(path);
  const sprite = new Sprite(texture);

  // Scale to desired height, maintaining aspect ratio
  const scale = height / sprite.texture.height;
  sprite.scale.set(scale);

  return sprite;
}
