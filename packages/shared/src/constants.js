/** @enum {string} */
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

/** @enum {string} */
export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];

/** @enum {string} */
export const PHASES = {
  BETTING: 'betting',
  INSURANCE: 'insurance',
  PLAYER_TURN: 'playerTurn',
  DEALER_TURN: 'dealerTurn',
  RESOLVED: 'resolved',
};

/** @enum {string} */
export const ACTIONS = {
  HIT: 'hit',
  STAND: 'stand',
  DOUBLE: 'double',
  SPLIT: 'split',
  SURRENDER: 'surrender',
  INSURANCE: 'insurance',
};

/** @enum {string} */
export const OUTCOMES = {
  WIN: 'win',
  LOSE: 'lose',
  PUSH: 'push',
  BLACKJACK: 'blackjack',
  SURRENDER: 'surrender',
};

export const PAYOUTS = {
  [OUTCOMES.WIN]: 2,
  [OUTCOMES.BLACKJACK]: 2.5,
  [OUTCOMES.PUSH]: 1,
  [OUTCOMES.LOSE]: 0,
};

export const DEFAULT_BALANCE = 1000;
export const MIN_BET = 5;
export const MAX_BET = 500;
export const NUM_DECKS = 6;
export const RESHUFFLE_THRESHOLD = 0.25;
