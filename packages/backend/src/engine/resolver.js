import { OUTCOMES, DEFAULT_RULES } from '@blackjack/shared';

/**
 * Compare player and dealer hands, determine outcome and payout.
 * @param {import('@blackjack/shared').Hand} playerHand
 * @param {import('@blackjack/shared').Hand} dealerHand
 * @param {number} bet
 * @param {import('@blackjack/shared').RuleConfig} [rules]
 * @returns {{ outcome: string, payout: number, message: string }}
 */
export function resolveRound(playerHand, dealerHand, bet, rules = DEFAULT_RULES) {
  if (playerHand.busted) {
    return {
      outcome: OUTCOMES.LOSE,
      payout: 0,
      message: 'Player busts. Dealer wins.',
    };
  }

  if (playerHand.blackjack && !dealerHand.blackjack) {
    const profit = bet * rules.blackjack_payout;
    return {
      outcome: OUTCOMES.BLACKJACK,
      payout: Math.floor(bet + profit),
      message: 'Blackjack! You win!',
    };
  }

  if (playerHand.blackjack && dealerHand.blackjack) {
    return {
      outcome: OUTCOMES.PUSH,
      payout: bet,
      message: 'Both have blackjack. Push.',
    };
  }

  if (dealerHand.blackjack) {
    return {
      outcome: OUTCOMES.LOSE,
      payout: 0,
      message: 'Dealer has blackjack. You lose.',
    };
  }

  if (dealerHand.busted) {
    return {
      outcome: OUTCOMES.WIN,
      payout: bet * 2,
      message: 'Dealer busts. You win!',
    };
  }

  if (playerHand.total > dealerHand.total) {
    return {
      outcome: OUTCOMES.WIN,
      payout: bet * 2,
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

/**
 * Resolve a surrender — player forfeits half their bet.
 * @param {number} bet
 * @returns {{ outcome: string, payout: number, message: string }}
 */
export function resolveSurrender(bet) {
  return {
    outcome: OUTCOMES.SURRENDER,
    payout: Math.floor(bet / 2),
    message: 'You surrendered. Half your bet is returned.',
  };
}
