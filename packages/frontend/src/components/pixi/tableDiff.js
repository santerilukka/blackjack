import { PHASES } from '@blackjack/shared';

/**
 * Build a card key string for diffing.
 * @param {{ rank: string, suit: string }} card
 * @returns {string}
 */
function cardKey(card) {
  return `${card.rank}_${card.suit}`;
}

/**
 * Diff the previous rendered state against the new game state.
 * Returns a list of rendering commands the scene should execute.
 *
 * @param {{ dealerCards: string[], playerCards: string[], phase: string|null }} prev
 * @param {object} gameState
 * @returns {{ dealerCmd: object|null, playerCmd: object|null, newRenderedState: object }}
 */
export function diffGameState(prev, gameState) {
  const { dealerHand, playerHand, phase } = gameState;

  const dealerCardKeys = dealerHand.cards.map(cardKey);
  const playerCardKeys = playerHand.cards.map(cardKey);

  const showDealerHidden = phase === PHASES.PLAYER_TURN;
  if (showDealerHidden) {
    dealerCardKeys.push('hidden');
  }

  let dealerCmd = null;
  let playerCmd = null;

  // Dealer hand diff
  if (!arraysEqual(dealerCardKeys, prev.dealerCards)) {
    const needsFullRedraw = prev.dealerCards.length > 0 &&
      !isPrefix(prev.dealerCards, dealerCardKeys);

    // Detect dealer reveal: previous had 'hidden' as last key, now replaced with actual card
    const isReveal = needsFullRedraw &&
      prev.dealerCards.length >= 2 &&
      prev.dealerCards[prev.dealerCards.length - 1] === 'hidden' &&
      isPrefix(prev.dealerCards.slice(0, -1), dealerCardKeys);

    if (isReveal) {
      const revealIndex = prev.dealerCards.length - 1;
      const revealedCard = dealerHand.cards[revealIndex];
      const extraCards = dealerHand.cards.slice(prev.dealerCards.length);
      dealerCmd = { type: 'reveal', revealIndex, revealedCard, extraCards };
    } else if (needsFullRedraw) {
      dealerCmd = { type: 'redraw', cards: dealerHand.cards, showHidden: showDealerHidden };
    } else {
      const newCards = dealerHand.cards.slice(prev.dealerCards.length);
      const addHidden = showDealerHidden && !prev.dealerCards.includes('hidden');
      dealerCmd = { type: 'add', cards: newCards, addHidden };
    }
  }

  // Player hand diff
  if (!arraysEqual(playerCardKeys, prev.playerCards)) {
    const newCards = playerHand.cards.slice(prev.playerCards.length);
    playerCmd = { type: 'add', cards: newCards, addHidden: false };
  }

  return {
    dealerCmd,
    playerCmd,
    showDealerHidden,
    newRenderedState: {
      dealerCards: dealerCardKeys,
      playerCards: playerCardKeys,
      phase,
    },
  };
}

/**
 * Format a hand total for display.
 * @param {{ cards: Array, total: number, soft: boolean, busted: boolean, blackjack: boolean }} hand
 * @returns {string}
 */
export function formatHandTotal(hand) {
  if (hand.cards.length === 0) return '';
  if (hand.blackjack) return 'BJ';
  if (hand.busted) return `${hand.total} BUST`;
  if (hand.soft) return `${hand.total} (soft)`;
  return String(hand.total);
}

/**
 * Get the dealer total display string, accounting for hidden card.
 * @param {object} dealerHand
 * @param {string} phase
 * @returns {string}
 */
export function formatDealerTotal(dealerHand, phase) {
  if (dealerHand.cards.length === 0) return '';
  if (phase === PHASES.PLAYER_TURN) return String(dealerHand.total);
  return formatHandTotal(dealerHand);
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Check if `prefix` is a prefix of `arr`. */
function isPrefix(prefix, arr) {
  if (prefix.length > arr.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] !== arr[i]) return false;
  }
  return true;
}
