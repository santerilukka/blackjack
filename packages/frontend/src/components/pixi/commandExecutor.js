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
export async function executeCommands({ dealerCmd, playerCmd, playerHandCmds, isSplit, activeHandIndex, handCount, showDealerHidden, gameState }, renderer) {
  if (isSplit && playerHandCmds && playerHandCmds.length > 0) {
    // --- Split mode: card changes ---
    const layoutCmds = playerHandCmds.filter(c => c.type === 'split-init' || c.type === 'split-relocate');
    const otherCmds = playerHandCmds.filter(c => c.type !== 'split-init' && c.type !== 'split-relocate');

    if (layoutCmds.length > 0) {
      // Animate chip for the split bet (each split-init means a new bet was placed)
      const splitInitCount = layoutCmds.filter(c => c.type === 'split-init').length;
      if (splitInitCount > 0 && gameState.playerHands) {
        const handBet = gameState.playerHands[0]?.bet || 0;
        if (handBet > 0) {
          renderer.animateSplitBet(handBet);
        }
      }
      await renderer.animateSplitInit(layoutCmds);
    }

    for (const cmd of otherCmds) {
      if (cmd.type === 'redraw') {
        renderer.initSplitMode(handCount);
        await renderer.redrawSplitHand(cmd.handIndex, cmd.cards);
      } else if (cmd.type === 'add') {
        await renderer.addSplitHandCards(cmd.handIndex, cmd.cards);
      }
    }
  } else if (playerCmd) {
    // --- Single-hand mode (unchanged) ---
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

  // Update split hand labels (always, even without card changes)
  if (isSplit && gameState.playerHands) {
    for (let i = 0; i < gameState.playerHands.length; i++) {
      renderer.updateSplitHandTotal(i, formatHandTotal(gameState.playerHands[i]));
      renderer.updateSplitHandBet(i, gameState.playerHands[i].bet || 0);
    }
    renderer.setActiveHand(activeHandIndex, gameState.playerHands);
  }

  // Update totals — in split mode, hide the single badge
  if (isSplit) {
    renderer.updatePlayerTotal('');
  } else {
    renderer.updatePlayerTotal(formatHandTotal(gameState.playerHand));
  }
  renderer.updateDealerTotal(formatDealerTotal(gameState.dealerHand, gameState.phase));
  renderer.updateBetSpot(gameState.currentBet || 0);

  // Cards on table count
  let playerCardCount;
  if (isSplit && gameState.playerHands) {
    playerCardCount = gameState.playerHands.reduce((sum, h) => sum + h.cards.length, 0);
  } else {
    playerCardCount = gameState.playerHand.cards.length;
  }
  const cardsOnTable = gameState.dealerHand.cards.length + playerCardCount +
    (showDealerHidden ? 1 : 0);
  renderer.updateStacks(gameState.shoeSize, cardsOnTable);
}
