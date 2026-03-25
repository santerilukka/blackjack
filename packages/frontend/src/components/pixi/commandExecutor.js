import { formatHandTotal, formatDealerTotal } from './tableDiff.js';

/**
 * @typedef {object} Renderer
 * @property {(cards: Array<{rank: string, suit: string}>, showHidden: boolean) => Promise<void>} redrawDealerHand
 * @property {(index: number, card: {rank: string, suit: string}) => Promise<void>} revealDealerCard
 * @property {(cards: Array<{rank: string, suit: string}>, addHidden: boolean) => Promise<void>} addDealerCards
 * @property {(cards: Array<{rank: string, suit: string}>, addHidden: boolean) => Promise<void>} addPlayerCards
 * @property {(text: string) => void} updatePlayerTotal
 * @property {(text: string) => void} updateDealerTotal
 * @property {(amount: number) => void} updateBetSpot
 * @property {(shoeSize: number, cardsOnTable: number) => void} updateStacks
 */

/**
 * Execute rendering commands produced by tableDiff against a renderer.
 * This is a pure orchestrator — all PixiJS interaction happens through the renderer interface,
 * making this function testable without a PixiJS runtime.
 *
 * @param {object} params
 * @param {object|null} params.dealerCmd - Dealer rendering command from diffGameState
 * @param {object|null} params.playerCmd - Player rendering command from diffGameState
 * @param {boolean} params.showDealerHidden - Whether dealer hidden card is shown
 * @param {object} params.gameState - Current game state
 * @param {Renderer} renderer - Renderer implementation
 */
export async function executeCommands({ dealerCmd, playerCmd, showDealerHidden, gameState }, renderer) {
  if (playerCmd) {
    await renderer.addPlayerCards(playerCmd.cards, playerCmd.addHidden);
  }

  if (dealerCmd) {
    if (dealerCmd.type === 'redraw') {
      await renderer.redrawDealerHand(dealerCmd.cards, dealerCmd.showHidden);
    } else if (dealerCmd.type === 'reveal') {
      await renderer.revealDealerCard(dealerCmd.revealIndex, dealerCmd.revealedCard);
      if (dealerCmd.extraCards.length > 0) {
        await renderer.addDealerCards(dealerCmd.extraCards, false);
      }
    } else {
      await renderer.addDealerCards(dealerCmd.cards, dealerCmd.addHidden);
    }
  }

  renderer.updatePlayerTotal(formatHandTotal(gameState.playerHand));
  renderer.updateDealerTotal(formatDealerTotal(gameState.dealerHand, gameState.phase));
  renderer.updateBetSpot(gameState.currentBet || 0);

  const cardsOnTable = gameState.dealerHand.cards.length + gameState.playerHand.cards.length +
    (showDealerHidden ? 1 : 0);
  renderer.updateStacks(gameState.shoeSize, cardsOnTable);
}
