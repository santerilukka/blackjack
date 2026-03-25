import { Sprite, Assets, Texture, Spritesheet } from 'pixi.js';

const RANK_NAME = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', '10': '10',
  'J': 'jack', 'Q': 'queen', 'K': 'king', 'A': 'ace',
};

const CARD_BACK_FRAME = 'back_red_1';

/** @type {Spritesheet | null} */
let spritesheet = null;

/**
 * Load the card sprite sheet. Call once at startup.
 * Subsequent calls return the cached sheet.
 * @returns {Promise<Spritesheet>}
 */
export async function loadCardSpritesheet() {
  if (spritesheet) return spritesheet;

  const atlas = await Assets.load('/cards/cards.json');

  // Assets.load on a spritesheet JSON returns the parsed Spritesheet directly
  // in PixiJS v8. If it returned the raw JSON, we build manually.
  if (atlas.textures) {
    spritesheet = atlas;
  } else {
    // Fallback: manual construction
    const tex = await Assets.load('/cards/cards.png');
    const sheet = new Spritesheet(tex, atlas);
    await sheet.parse();
    spritesheet = sheet;
  }

  return spritesheet;
}

/**
 * Get the sprite sheet frame name for a card.
 * @param {{ rank: string, suit: string } | null} card  null = face-down
 * @returns {string}
 */
export function cardFrameName(card) {
  if (!card) return CARD_BACK_FRAME;
  const rank = RANK_NAME[card.rank] || card.rank;
  return `${rank}_${card.suit}`;
}

/**
 * Create a PixiJS Sprite for a card from the sprite sheet.
 * @param {{ rank: string, suit: string } | null} card  null = face-down
 * @param {{ height?: number }} options
 * @returns {Promise<Sprite>}
 */
/**
 * Get the texture for a card from the cached spritesheet.
 * @param {{ rank: string, suit: string } | null} card  null = face-down
 * @returns {Promise<Texture>}
 */
export async function getCardTexture(card) {
  const sheet = await loadCardSpritesheet();
  const frame = cardFrameName(card);
  return sheet.textures[frame] || Texture.WHITE;
}

export async function createCardSprite(card, { height = 140 } = {}) {
  const sheet = await loadCardSpritesheet();
  const frame = cardFrameName(card);
  const texture = sheet.textures[frame] || Texture.WHITE;

  if (!sheet.textures[frame]) {
    console.warn(`Missing card frame: ${frame}`);
  }

  const sprite = new Sprite(texture);

  // Scale to desired height, maintaining aspect ratio
  const scale = height / sprite.texture.height;
  sprite.scale.set(scale);
  sprite.anchor.set(0.5);

  return sprite;
}
