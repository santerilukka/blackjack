import { OUTCOMES, PAYOUTS } from '@blackjack/shared';

/**
 * Compare player and dealer hands, determine outcome and payout.
 * @param {import('@blackjack/shared').Hand} playerHand
 * @param {import('@blackjack/shared').Hand} dealerHand
 * @param {number} bet
 * @returns {{ outcome: string, payout: number, message: string }}
 */
export function resolveRound(playerHand, dealerHand, bet) {
  // Player busted
  if (playerHand.busted) {
    return {
      outcome: OUTCOMES.LOSE,
      payout: 0,
      message: 'Player busts. Dealer wins.',
    };
  }

  // Player blackjack
  if (playerHand.blackjack && !dealerHand.blackjack) {
    return {
      outcome: OUTCOMES.BLACKJACK,
      payout: Math.floor(bet * PAYOUTS[OUTCOMES.BLACKJACK]),
      message: 'Blackjack! You win!',
    };
  }

  // Both blackjack
  if (playerHand.blackjack && dealerHand.blackjack) {
    return {
      outcome: OUTCOMES.PUSH,
      payout: bet,
      message: 'Both have blackjack. Push.',
    };
  }

  // Dealer blackjack (player does not have blackjack)
  if (dealerHand.blackjack) {
    return {
      outcome: OUTCOMES.LOSE,
      payout: 0,
      message: 'Dealer has blackjack. You lose.',
    };
  }

  // Dealer busted
  if (dealerHand.busted) {
    return {
      outcome: OUTCOMES.WIN,
      payout: bet * PAYOUTS[OUTCOMES.WIN],
      message: 'Dealer busts. You win!',
    };
  }

  // Compare totals
  if (playerHand.total > dealerHand.total) {
    return {
      outcome: OUTCOMES.WIN,
      payout: bet * PAYOUTS[OUTCOMES.WIN],
      message: `You win! ${playerHand.total} beats ${dealerHand.total}.`,
    };
  }

  if (playerHand.total < dealerHand.total) {
    return {
      outcome: OUTCOMES.LOSE,
      payout: 0,
      message: `Dealer wins. ${dealerHand.total} beats ${playerHand.total}.`,
    };
  }

  return {
    outcome: OUTCOMES.PUSH,
    payout: bet,
    message: `Push. Both have ${playerHand.total}.`,
  };
}
