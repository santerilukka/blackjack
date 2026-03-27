/**
 * Maps game sound event names to arrays of audio file paths (variants).
 * Multiple variants per event enable random selection to avoid repetition.
 * Paths are relative to the public/ directory.
 * @type {Record<string, string[]>}
 */
export const SOUND_MAP = {
  // --- Card events ---
  cardDeal: [
    '/audio/card-slide-1.ogg',
    '/audio/card-slide-2.ogg',
    '/audio/card-slide-3.ogg',
    '/audio/card-slide-4.ogg',
    '/audio/card-slide-5.ogg',
    '/audio/card-slide-6.ogg',
    '/audio/card-slide-7.ogg',
    '/audio/card-slide-8.ogg',
  ],
  cardFlip: [
    '/audio/card-shove-1.ogg',
    '/audio/card-shove-2.ogg',
    '/audio/card-shove-3.ogg',
    '/audio/card-shove-4.ogg',
  ],
  cardPlace: [
    '/audio/card-place-1.ogg',
    '/audio/card-place-2.ogg',
    '/audio/card-place-3.ogg',
    '/audio/card-place-4.ogg',
  ],
  cardFan: [
    '/audio/card-fan-1.ogg',
    '/audio/card-fan-2.ogg',
  ],
  cardShuffle: [
    '/audio/card-shuffle.ogg',
  ],
  packOpen: [
    '/audio/cards-pack-open-1.ogg',
    '/audio/cards-pack-open-2.ogg',
  ],
  packTakeOut: [
    '/audio/cards-pack-take-out-1.ogg',
    '/audio/cards-pack-take-out-2.ogg',
  ],

  // --- Chip events ---
  chipLay: [
    '/audio/chip-lay-1.ogg',
    '/audio/chip-lay-2.ogg',
    '/audio/chip-lay-3.ogg',
  ],
  chipCollide: [
    '/audio/chips-collide-1.ogg',
    '/audio/chips-collide-2.ogg',
    '/audio/chips-collide-3.ogg',
    '/audio/chips-collide-4.ogg',
  ],
  chipHandle: [
    '/audio/chips-handle-1.ogg',
    '/audio/chips-handle-2.ogg',
    '/audio/chips-handle-3.ogg',
    '/audio/chips-handle-4.ogg',
    '/audio/chips-handle-5.ogg',
    '/audio/chips-handle-6.ogg',
  ],
  chipStack: [
    '/audio/chips-stack-1.ogg',
    '/audio/chips-stack-2.ogg',
    '/audio/chips-stack-3.ogg',
    '/audio/chips-stack-4.ogg',
    '/audio/chips-stack-5.ogg',
    '/audio/chips-stack-6.ogg',
  ],

  // --- Outcome events ---
  winNormal: ['/audio/normal_win.mp3'],
  winBlackjack: ['/audio/Straight_blackack_win.mp3'],
  lose: [
    '/audio/no_win1.mp3',
    '/audio/no_win2.mp3',
    '/audio/no_win3.mp3',
    '/audio/no_win4.mp3',
    '/audio/no_win5.mp3',
  ],
  outOfMoney: ['/audio/player_out_of_money.mp3'],

  // --- UI events ---
  uiClick: ['/audio/navigation_click.mp3'],
  shopPurchase: ['/audio/shop_purchase.mp3'],
};
