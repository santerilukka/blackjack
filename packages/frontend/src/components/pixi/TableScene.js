import { Container, Graphics, Text } from 'pixi.js';
import { createCardSprite } from './CardSprite.js';
import { AnimationQueue } from './AnimationQueue.js';
import { BetSpot } from './BetSpot.js';
import { StackRenderer } from './StackRenderer.js';
import { diffGameState } from './tableDiff.js';
import { executeCommands } from './commandExecutor.js';

const CARD_HEIGHT = 130;
const CARD_GAP = 12;
const DEALER_Y = 30;
const PLAYER_Y = 290;
const LABEL_OFFSET_Y = -5;

const STACK_CARD_HEIGHT = 100;

// Betting spot position
const BET_CIRCLE_X = 50;
const BET_CIRCLE_Y = 370;

/**
 * TableScene manages the visual layout of the blackjack table on a PixiJS stage.
 * Implements the Renderer interface consumed by commandExecutor.
 */
export class TableScene {
  /**
   * @param {import('pixi.js').Application} app
   */
  constructor(app) {
    this.app = app;
    this.root = new Container();
    app.stage.addChild(this.root);

    this.animationQueue = new AnimationQueue();

    // Felt background
    this._drawFelt();

    // Labels
    this.dealerLabel = new Text({ text: 'Dealer', style: { fill: '#ffffff', fontSize: 18, fontFamily: 'sans-serif' } });
    this.dealerLabel.x = 20;
    this.dealerLabel.y = DEALER_Y + LABEL_OFFSET_Y;
    this.root.addChild(this.dealerLabel);

    this.dealerTotal = new Text({ text: '', style: { fill: '#ffd700', fontSize: 18, fontFamily: 'sans-serif', fontWeight: 'bold' } });
    this.dealerTotal.x = 100;
    this.dealerTotal.y = DEALER_Y + LABEL_OFFSET_Y;
    this.root.addChild(this.dealerTotal);

    this.playerLabel = new Text({ text: 'Player', style: { fill: '#ffffff', fontSize: 18, fontFamily: 'sans-serif' } });
    this.playerLabel.x = 20;
    this.playerLabel.y = PLAYER_Y + LABEL_OFFSET_Y;
    this.root.addChild(this.playerLabel);

    this.playerTotal = new Text({ text: '', style: { fill: '#ffd700', fontSize: 18, fontFamily: 'sans-serif', fontWeight: 'bold' } });
    this.playerTotal.x = 100;
    this.playerTotal.y = PLAYER_Y + LABEL_OFFSET_Y;
    this.root.addChild(this.playerTotal);

    // Card containers
    this.dealerCards = new Container();
    this.dealerCards.x = 100;
    this.dealerCards.y = DEALER_Y + 20;
    this.root.addChild(this.dealerCards);

    this.playerCards = new Container();
    this.playerCards.x = 100;
    this.playerCards.y = PLAYER_Y + 20;
    this.root.addChild(this.playerCards);

    // Shoe stack
    const shoeX = this.app.screen.width - 120;
    this.shoeStack = new StackRenderer(
      shoeX, DEALER_Y + 20,
      shoeX + 35, DEALER_Y + 20 + STACK_CARD_HEIGHT + 8,
    );
    this.root.addChild(this.shoeStack.container);
    this.root.addChild(this.shoeStack.label);

    // Discard stack
    this.discardStack = new StackRenderer(
      shoeX, PLAYER_Y + 20,
      shoeX + 35, PLAYER_Y + 20 + STACK_CARD_HEIGHT + 8,
    );
    this.root.addChild(this.discardStack.container);
    this.root.addChild(this.discardStack.label);

    // Betting spot
    this.betSpot = new BetSpot(BET_CIRCLE_X, BET_CIRCLE_Y);
    this.root.addChild(this.betSpot.container);

    /** Track what's currently rendered to diff against new state */
    this._renderedState = { dealerCards: [], playerCards: [], phase: null };
    this._shoeSize = 0;
    this._totalCards = 0;
    this._discardCount = 0;
  }

  _drawFelt() {
    const g = new Graphics();
    g.roundRect(0, 0, this.app.screen.width, this.app.screen.height, 16);
    g.fill('#2d7a3e');
    g.roundRect(4, 4, this.app.screen.width - 8, this.app.screen.height - 8, 14);
    g.stroke({ color: '#1a5c2a', width: 3 });
    const midY = this.app.screen.height / 2;
    g.moveTo(40, midY);
    g.lineTo(this.app.screen.width - 40, midY);
    g.stroke({ color: 'rgba(255,255,255,0.15)', width: 1 });
    g.circle(BET_CIRCLE_X, BET_CIRCLE_Y, this.betSpot?.radius ?? 32 + 4);
    g.stroke({ color: 'rgba(255,255,255,0.12)', width: 1.5 });
    this.root.addChildAt(g, 0);
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

  /** @param {Array<{rank: string, suit: string}>} cards */
  async addPlayerCards(cards, addHidden) {
    await this._addCards(this.playerCards, cards, addHidden);
  }

  /** @param {string} text */
  updatePlayerTotal(text) {
    this.playerTotal.text = text;
  }

  /** @param {string} text */
  updateDealerTotal(text) {
    this.dealerTotal.text = text;
  }

  /** @param {number} amount */
  updateBetSpot(amount) {
    this.betSpot.update(amount);
  }

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

    const diff = diffGameState(this._renderedState, gameState);
    const { dealerCmd, playerCmd, showDealerHidden, newRenderedState } = diff;

    // Enqueue rendering via animation queue, delegating to executeCommands
    const renderer = this;
    if (dealerCmd || playerCmd) {
      this.animationQueue.enqueue(async () => {
        await executeCommands({ dealerCmd, playerCmd, showDealerHidden, gameState }, renderer);
      });
    } else {
      // No card changes, just update labels/stacks synchronously
      await executeCommands({ dealerCmd: null, playerCmd: null, showDealerHidden, gameState }, renderer);
    }

    this._renderedState = newRenderedState;
  }

  /**
   * Remove all cards from the scene (e.g. new round).
   * @param {number} [shoeSize]
   */
  clear(shoeSize) {
    this.animationQueue.clear();
    this.dealerCards.removeChildren();
    this.playerCards.removeChildren();
    this._renderedState = { dealerCards: [], playerCards: [], phase: null };
    this.betSpot.clear();
    this.dealerTotal.text = '';
    this.playerTotal.text = '';

    if (shoeSize != null) {
      this._updateStacksInternal(shoeSize, 0);
    }
  }

  destroy() {
    this.animationQueue.clear();
    this.root.destroy({ children: true });
  }

  // --- Internal rendering helpers (PixiJS-specific) ---

  /**
   * Update shoe and discard pile visuals.
   */
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
   * Full re-render of a hand (used for dealer reveal).
   * @param {Container} container
   * @param {Array<{rank: string, suit: string}>} cards
   * @param {boolean} appendHidden
   */
  async _renderHand(container, cards, appendHidden) {
    container.removeChildren();

    let x = 0;
    for (const card of cards) {
      const sprite = await createCardSprite(card, { height: CARD_HEIGHT });
      sprite.x = x;
      sprite.y = 0;
      sprite.alpha = 0;
      container.addChild(sprite);
      await fadeIn(sprite, this.app);
      x += sprite.width + CARD_GAP;
    }

    if (appendHidden) {
      const hidden = await createCardSprite(null, { height: CARD_HEIGHT });
      hidden.x = x;
      hidden.y = 0;
      hidden.alpha = 0;
      container.addChild(hidden);
      await fadeIn(hidden, this.app);
    }
  }

  /**
   * Incrementally add new cards to an existing hand container.
   * @param {Container} container
   * @param {Array<{rank: string, suit: string}>} newCards
   * @param {boolean} appendHidden
   */
  async _addCards(container, newCards, appendHidden) {
    let x = 0;
    if (container.children.length > 0) {
      const last = container.children[container.children.length - 1];
      x = last.x + last.width + CARD_GAP;
    }

    for (const card of newCards) {
      const sprite = await createCardSprite(card, { height: CARD_HEIGHT });
      sprite.x = x;
      sprite.y = 0;
      sprite.alpha = 0;
      container.addChild(sprite);
      await fadeIn(sprite, this.app);
      x += sprite.width + CARD_GAP;
    }

    if (appendHidden) {
      const hidden = await createCardSprite(null, { height: CARD_HEIGHT });
      hidden.x = x;
      hidden.y = 0;
      hidden.alpha = 0;
      container.addChild(hidden);
      await fadeIn(hidden, this.app);
    }
  }
}

/** Fade a sprite from 0 → 1 over ~200ms using the app ticker. */
function fadeIn(sprite, app) {
  return new Promise((resolve) => {
    const duration = 200;
    let elapsed = 0;
    const tick = (ticker) => {
      elapsed += ticker.deltaMS;
      sprite.alpha = Math.min(elapsed / duration, 1);
      if (elapsed >= duration) {
        sprite.alpha = 1;
        app.ticker.remove(tick);
        resolve();
      }
    };
    app.ticker.add(tick);
  });
}
