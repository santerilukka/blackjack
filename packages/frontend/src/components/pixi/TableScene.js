import { Container, Graphics, Text } from 'pixi.js';
import { createCardSprite } from './CardSprite.js';
import { AnimationQueue } from './AnimationQueue.js';

const CARD_HEIGHT = 130;
const CARD_GAP = 12;
const DEALER_Y = 30;
const PLAYER_Y = 290;
const LABEL_OFFSET_Y = -5;

/**
 * TableScene manages the visual layout of the blackjack table on a PixiJS stage.
 * It holds dealer and player hand containers and provides methods to sync
 * with the game state returned by the API.
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

    this.playerLabel = new Text({ text: 'Player', style: { fill: '#ffffff', fontSize: 18, fontFamily: 'sans-serif' } });
    this.playerLabel.x = 20;
    this.playerLabel.y = PLAYER_Y + LABEL_OFFSET_Y;
    this.root.addChild(this.playerLabel);

    // Card containers
    this.dealerCards = new Container();
    this.dealerCards.x = 100;
    this.dealerCards.y = DEALER_Y + 20;
    this.root.addChild(this.dealerCards);

    this.playerCards = new Container();
    this.playerCards.x = 100;
    this.playerCards.y = PLAYER_Y + 20;
    this.root.addChild(this.playerCards);

    /** Track what's currently rendered to diff against new state */
    this._renderedState = { dealerCards: [], playerCards: [], phase: null };
  }

  _drawFelt() {
    const g = new Graphics();
    g.roundRect(0, 0, this.app.screen.width, this.app.screen.height, 16);
    g.fill('#2d7a3e');
    // Table border
    g.roundRect(4, 4, this.app.screen.width - 8, this.app.screen.height - 8, 14);
    g.stroke({ color: '#1a5c2a', width: 3 });
    // Center divider line
    const midY = this.app.screen.height / 2;
    g.moveTo(40, midY);
    g.lineTo(this.app.screen.width - 40, midY);
    g.stroke({ color: 'rgba(255,255,255,0.15)', width: 1 });
    this.root.addChildAt(g, 0);
  }

  /**
   * Sync the scene with the current game state.
   * Diffs against the previously rendered state to determine what changed,
   * and only adds new cards (instead of re-rendering the entire hand).
   *
   * @param {object} gameState - Full game state from the API
   */
  async update(gameState) {
    if (!gameState) return;

    const { dealerHand, playerHand, phase } = gameState;

    // Build card key arrays for diffing
    const dealerCardKeys = dealerHand.cards.map(c => `${c.rank}_${c.suit}`);
    const playerCardKeys = playerHand.cards.map(c => `${c.rank}_${c.suit}`);

    // During playerTurn, dealer has a hidden card
    const showDealerHidden = phase === 'playerTurn';
    if (showDealerHidden) {
      dealerCardKeys.push('hidden');
    }

    const prevDealer = this._renderedState.dealerCards;
    const prevPlayer = this._renderedState.playerCards;

    // Dealer hand: check if we need a full re-render (reveal) or incremental add
    if (!arraysEqual(dealerCardKeys, prevDealer)) {
      const needsFullRedraw = prevDealer.length > 0 &&
        !isPrefix(prevDealer, dealerCardKeys);

      if (needsFullRedraw) {
        // Dealer reveal: re-render the whole hand (hidden → face-up transition)
        this.animationQueue.enqueue(() => this._renderHand(
          this.dealerCards, dealerHand.cards, showDealerHidden
        ));
      } else {
        // Incremental: only add new cards
        const newCards = dealerHand.cards.slice(prevDealer.length);
        const addHidden = showDealerHidden && !prevDealer.includes('hidden');
        this.animationQueue.enqueue(() => this._addCards(
          this.dealerCards, newCards, addHidden
        ));
      }
    }

    // Player hand: always incremental (cards only get added)
    if (!arraysEqual(playerCardKeys, prevPlayer)) {
      const newCards = playerHand.cards.slice(prevPlayer.length);
      this.animationQueue.enqueue(() => this._addCards(
        this.playerCards, newCards, false
      ));
    }

    this._renderedState = {
      dealerCards: dealerCardKeys,
      playerCards: playerCardKeys,
      phase,
    };
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
    // Calculate x offset from existing children
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

  /** Remove all cards from the scene (e.g. new round). */
  clear() {
    this.animationQueue.clear();
    this.dealerCards.removeChildren();
    this.playerCards.removeChildren();
    this._renderedState = { dealerCards: [], playerCards: [], phase: null };
  }

  destroy() {
    this.animationQueue.clear();
    this.root.destroy({ children: true });
  }
}

/** Fade a sprite from 0 → 1 over ~200ms using the app ticker. */
function fadeIn(sprite, app) {
  return new Promise((resolve) => {
    const duration = 200; // ms
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
