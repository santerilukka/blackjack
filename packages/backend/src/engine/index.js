// Engine public API — barrel export for discoverability.

export { evaluateHand, cardValue, calculateTotal } from './evaluator.js';
export { executeAction } from './actions.js';
export { placeBet, resolveInsurance, startNewRound, dealInitialCards, classifyDeal } from './round.js';
export { resolveRound, resolveSurrender } from './resolver.js';
export { playDealerTurn } from './dealer.js';
export { getAvailableActions, canSplitHand, actionsForHand, actionsForSplitHand } from './actionRules.js';
export { runDealerAndResolve } from './dealerResolution.js';
export { Deck } from './deck.js';
export { createShoe } from './shoe.js';
export { buildResolvedState, buildPlayerTurnState, buildInsuranceState, buildSplitTurnState, buildSplitResolvedState, revealDealerCards } from './stateBuilder.js';
export { assertValidGameState } from './stateValidator.js';
