import { Container } from 'pixi.js';
import { createCardSprite, getCardTexture, loadCardSpritesheet } from './CardSprite.js';
import { loadChipTextures } from './ChipSprite.js';
import { AnimationQueue } from './AnimationQueue.js';
import { BetSpot } from './BetSpot.js';
import { StackRenderer } from './StackRenderer.js';
import { diffGameState } from './tableDiff.js';
import { executeCommands } from './commandExecutor.js';
import { tween, easeOutCubic, easeOutQuad } from './tween.js';
import { SeatMarker, computeSeatPositions } from './SeatMarker.js';
import { playShuffleAnimation } from './ShuffleAnimation.js';
import { playResultAnimation } from './ResultAnimation.js';
import { PHASES } from '@blackjack/shared';
import { LAYOUT, CARD_HEIGHT, CARD_OVERLAP } from './tableLayout.js';
import { createTotalBadge, updateBadge } from './BadgeRenderer.js';
import { FeltRenderer } from './FeltRenderer.js';
import { SplitModeManager } from './SplitModeManager.js';
import { play } from '../../audio/SoundManager.js';

/**
 * TableScene manages the visual layout of the blackjack table on a PixiJS stage.
 * Implements the Renderer interface consumed by commandExecutor.
 *
 * Delegates to:
 * - FeltRenderer: felt background, decorative elements
 * - BadgeRenderer: hand total badges
 * - SplitModeManager: split-hand containers and animations
 */
export class TableScene {
  /**
   * @param {import('pixi.js').Application} app
   * @param {{ npcCount?: number }} [options]
   */
  constructor(app, { npcCount = 0 } = {}) {
    this.app = app;
    this.root = new Container();
    app.stage.addChild(this.root);

    this.animationQueue = new AnimationQueue();

    // Preload card sprite sheet and chip textures so first deal/bet is instant
    loadCardSpritesheet();
    loadChipTextures();

    // Felt background (delegated)
    this._felt = new FeltRenderer(this.root, app);
    this._felt.draw();

    // Seat markers (NPC placeholders + player seat)
    this._seatMarkers = [];
    this._drawSeats(npcCount);

    // Hand total badges
    this.dealerTotal = createTotalBadge(LAYOUT.dealer.cardsX, LAYOUT.dealer.cardsY - CARD_HEIGHT / 2 - 16);
    this.root.addChild(this.dealerTotal);

    this.playerTotal = createTotalBadge(LAYOUT.player.cardsX, LAYOUT.player.cardsY + CARD_HEIGHT / 2 + 16);
    this.root.addChild(this.playerTotal);

    // Card containers
    this.dealerCards = new Container();
    this.dealerCards.x = LAYOUT.dealer.cardsX;
    this.dealerCards.y = LAYOUT.dealer.cardsY;
    this.root.addChild(this.dealerCards);

    this.playerCards = new Container();
    this.playerCards.x = LAYOUT.player.cardsX;
    this.playerCards.y = LAYOUT.player.cardsY;
    this.root.addChild(this.playerCards);

    // Shoe stack (center-anchored)
    this.shoeStack = new StackRenderer(LAYOUT.shoe.x, LAYOUT.shoe.y);
    this.root.addChild(this.shoeStack.container);
    this.root.addChild(this.shoeStack.label);

    // Discard stack (center-anchored)
    this.discardStack = new StackRenderer(LAYOUT.discard.x, LAYOUT.discard.y);
    this.root.addChild(this.discardStack.container);
    this.root.addChild(this.discardStack.label);

    // Betting spot
    this.betSpot = new BetSpot(LAYOUT.bet.x, LAYOUT.bet.y);
    this.root.addChild(this.betSpot.container);

    this._currentMessage = '';

    // Result animation state
    this._resultAnimPlayed = false;
    /** @type {((overlay: { outcome: string|null, show: boolean }) => void)|null} */
    this.onResultOverlay = null;

    // Split mode manager
    this._splitManager = new SplitModeManager(this.root, app, {
      centerHand: (c) => this._centerHand(c),
      addCards: (c, cards, hidden) => this._addCards(c, cards, hidden),
    });

    /** Track what's currently rendered to diff against new state */
    this._renderedState = { dealerCards: [], playerCards: [], playerHandCards: [], phase: null };
    this._shoeSize = 0;
    this._totalCards = 0;
    this._discardCount = 0;
  }

  // --- Convenience accessors for split state (used by commandExecutor, ResultAnimation, PixiCanvas) ---

  get _splitContainers() { return this._splitManager.containers; }
  get _isSplit() { return this._splitManager.isSplit; }

  /** Single-hand element refs passed to SplitModeManager */
  get _singleHandElements() {
    return { playerCards: this.playerCards, playerTotal: this.playerTotal, betSpot: this.betSpot };
  }

  // --- Seat drawing ---

  /**
   * Draw NPC placeholder seats and the player seat along the arc.
   * @param {number} npcCount
   */
  _drawSeats(npcCount) {
    for (const marker of this._seatMarkers) {
      this.root.removeChild(marker.container);
    }
    this._seatMarkers = [];

    const totalSeats = 1 + npcCount;
    if (totalSeats <= 1) return;

    const positions = computeSeatPositions(totalSeats, LAYOUT.seats);

    for (const pos of positions) {
      const marker = new SeatMarker(pos.x, pos.y, {
        label: pos.isPlayer ? 'YOU' : 'EMPTY',
        isPlayer: pos.isPlayer,
      });
      this._seatMarkers.push(marker);
      this.root.addChild(marker.container);
    }
  }

  // --- Badge updates (delegated) ---

  /** @deprecated Messages are now rendered in React DOM */
  showMessage() {}

  /** @deprecated Messages are now rendered in React DOM */
  hideMessage() {}

  /** @param {string} text */
  updatePlayerTotal(text) {
    this.playerTotal._label.text = text;
    updateBadge(this.playerTotal);
  }

  /** @param {string} text */
  updateDealerTotal(text) {
    this.dealerTotal._label.text = text;
    updateBadge(this.dealerTotal);
  }

  // --- Renderer interface implementation ---

  /** @param {Array<{rank: string, suit: string}>} cards */
  async redrawDealerHand(cards, showHidden) {
    await this._renderHand(this.dealerCards, cards, showHidden);
  }

  /** @param {Array<{rank: string, suit: string}>} cards */
  async addDealerCards(cards, addHidden) {
    await this._addCards(this.dealerCards, cards, addHidden);
  }

  /**
   * Flip the dealer's hidden card to reveal the actual card.
   * @param {number} index - Index of the card in the dealer container
   * @param {{ rank: string, suit: string }} card - The revealed card
   */
  async revealDealerCard(index, card) {
    const sprite = this.dealerCards.children[index];
    if (!sprite) return;

    const texture = await getCardTexture(card);

    play('cardFlip');
    await tween(sprite, { scaleX: 0 }, 200, this.app, { easing: easeOutQuad });
    sprite.texture = texture;
    const targetScaleX = CARD_HEIGHT / texture.height;
    await tween(sprite, { scaleX: targetScaleX }, 200, this.app, { easing: easeOutQuad });
  }

  /** @param {Array<{rank: string, suit: string}>} cards */
  async addPlayerCards(cards, addHidden) {
    await this._addCards(this.playerCards, cards, addHidden);
  }

  // --- Split hand renderer methods (delegated to SplitModeManager) ---

  initSplitMode(handCount) {
    this._splitManager.init(handCount, this._singleHandElements);
  }

  async animateSplitInit(layoutCmds, perHandBet = 0) {
    await this._splitManager.animateSplitInit(layoutCmds, perHandBet, this._singleHandElements);
  }

  clearSplitMode() {
    this._splitManager.clear(this._singleHandElements);
  }

  setActiveHand(activeHandIndex, hands) {
    this._splitManager.setActiveHand(activeHandIndex, hands);
  }

  async addSplitHandCards(handIndex, cards) {
    await this._splitManager.addSplitHandCards(handIndex, cards);
  }

  async redrawSplitHand(handIndex, cards) {
    await this._splitManager.redrawSplitHand(handIndex, cards, (c, crds, h) => this._renderHand(c, crds, h));
  }

  updateSplitHandTotal(handIndex, text) {
    this._splitManager.updateSplitHandTotal(handIndex, text, updateBadge);
  }

  updateSplitHandBet(handIndex, amount) {
    this._splitManager.updateSplitHandBet(handIndex, amount);
  }

  // --- Bet spot ---

  /** @param {number} amount */
  updateBetSpot(amount) {
    if (this._isSplit) return;
    this.betSpot.update(amount);
  }

  addBetChip(denomination) {
    return this.betSpot.addChip(denomination, this.app);
  }

  clearBetChips() {
    this.betSpot.clearChips();
  }

  // --- Stacks ---

  /** @param {number} shoeSize @param {number} cardsOnTable */
  updateStacks(shoeSize, cardsOnTable) {
    this._updateStacksInternal(shoeSize, cardsOnTable);
  }

  // --- Scene orchestration ---

  /**
   * Sync the scene with the current game state.
   * Uses diffGameState to compute commands, then delegates to executeCommands.
   * @param {object} gameState
   */
  async update(gameState) {
    if (!gameState) return;

    const renderer = this;
    this.animationQueue.enqueue(async () => {
      const diff = diffGameState(this._renderedState, gameState);
      const { dealerCmd, playerCmd, playerHandCmds, isSplit, activeHandIndex, handCount, showDealerHidden, newRenderedState } = diff;
      await executeCommands({ dealerCmd, playerCmd, playerHandCmds, isSplit, activeHandIndex, handCount, showDealerHidden, gameState }, renderer);
      this._renderedState = newRenderedState;

      // Trigger result animation on RESOLVED transition
      if (gameState.phase === PHASES.RESOLVED && gameState.outcome && !this._resultAnimPlayed) {
        this._resultAnimPlayed = true;
        this.onResultOverlay?.({
          outcome: gameState.outcome,
          show: true,
          payout: gameState.payout,
          totalBet: gameState.currentBet,
        });
        await playResultAnimation({
          app: this.app,
          root: this.root,
          outcome: gameState.outcome,
          betSpot: this.betSpot,
          splitContainers: this._splitContainers,
          isSplit: this._isSplit,
          handResults: gameState.handResults,
          payout: gameState.payout,
          totalBet: gameState.currentBet,
        });
        this.onResultOverlay?.({ outcome: null, show: false });
      }
    });
  }

  /**
   * Enqueue a casino-style shuffle animation.
   * @param {{ showCollect?: boolean }} options
   * @returns {Promise<void>}
   */
  playShuffle({ showCollect = false } = {}) {
    return new Promise(resolve => {
      this.animationQueue.enqueue(async () => {
        await playShuffleAnimation({
          app: this.app,
          root: this.root,
          showCollect,
        });
        resolve();
      });
    });
  }

  /**
   * Remove all cards from the scene (e.g. new round).
   * @param {number} [shoeSize]
   */
  clear(shoeSize) {
    this.animationQueue.clear();
    this.clearSplitMode();
    this.dealerCards.removeChildren();
    this.dealerCards.pivot.x = 0;
    this.playerCards.removeChildren();
    this.playerCards.pivot.x = 0;
    this._renderedState = { dealerCards: [], playerCards: [], playerHandCards: [], phase: null };
    this.betSpot.clear();
    this.dealerTotal._label.text = '';
    updateBadge(this.dealerTotal);
    this.playerTotal._label.text = '';
    updateBadge(this.playerTotal);

    this._currentMessage = '';
    this._resultAnimPlayed = false;

    if (shoeSize != null) {
      this._updateStacksInternal(shoeSize, 0);
    }
  }

  /**
   * Apply a new felt color theme.
   * @param {{ fill: string, rim: string, bg: string }} colors
   */
  applyFeltColors(colors) {
    this._felt.applyColors(colors);
  }

  destroy() {
    this.animationQueue.clear();
    this.root.destroy({ children: true });
  }

  // --- Internal rendering helpers ---

  _updateStacksInternal(shoeSize, cardsOnTable) {
    if (this._totalCards === 0 || shoeSize > this._shoeSize) {
      this._totalCards = shoeSize + cardsOnTable;
    }

    const discardCount = Math.max(0, this._totalCards - shoeSize - cardsOnTable);

    this._shoeSize = shoeSize;
    this.shoeStack.update(shoeSize, `Shoe: ${shoeSize}`);

    this._discardCount = discardCount;
    this.discardStack.update(discardCount, discardCount > 0 ? `Discard: ${discardCount}` : '');
  }

  /**
   * Center a hand container's pivot so cards are centered around the container's position.
   * @param {Container} container
   */
  _centerHand(container) {
    const n = container.children.length;
    if (n === 0) {
      container.pivot.x = 0;
      return;
    }
    container.pivot.x = (n - 1) * CARD_OVERLAP / 2;
  }

  /**
   * Full re-render of a hand (used for dealer reveal).
   * @param {Container} container
   * @param {Array<{rank: string, suit: string}>} cards
   * @param {boolean} appendHidden
   */
  async _renderHand(container, cards, appendHidden) {
    container.removeChildren();
    container.pivot.x = 0;
    await this._addCards(container, cards, appendHidden);
  }

  /**
   * Incrementally add new cards to an existing hand container.
   * @param {Container} container
   * @param {Array<{rank: string, suit: string}>} newCards
   * @param {boolean} appendHidden
   */
  async _addCards(container, newCards, appendHidden) {
    let i = container.children.length;

    for (const card of newCards) {
      const sprite = await createCardSprite(card, { height: CARD_HEIGHT });
      sprite._cardRank = card.rank;
      sprite._cardSuit = card.suit;
      const targetX = i * CARD_OVERLAP;
      const targetY = 0;

      sprite.x = LAYOUT.shoe.x - container.x + container.pivot.x;
      sprite.y = LAYOUT.shoe.y - container.y;
      sprite.alpha = 0;
      container.addChild(sprite);
      this._centerHand(container);

      sprite.x = LAYOUT.shoe.x - container.x + container.pivot.x;
      sprite.y = LAYOUT.shoe.y - container.y;

      play('cardDeal');
      await tween(sprite, { x: targetX, y: targetY, alpha: 1 }, 350, this.app, { easing: easeOutCubic });
      i++;
    }

    if (appendHidden) {
      const hidden = await createCardSprite(null, { height: CARD_HEIGHT });
      const targetX = i * CARD_OVERLAP;
      const targetY = 0;

      hidden.x = LAYOUT.shoe.x - container.x + container.pivot.x;
      hidden.y = LAYOUT.shoe.y - container.y;
      hidden.alpha = 0;
      container.addChild(hidden);
      this._centerHand(container);

      hidden.x = LAYOUT.shoe.x - container.x + container.pivot.x;
      hidden.y = LAYOUT.shoe.y - container.y;

      play('cardDeal');
      await tween(hidden, { x: targetX, y: targetY, alpha: 1 }, 350, this.app, { easing: easeOutCubic });
    }
  }
}
