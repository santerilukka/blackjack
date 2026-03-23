import { Container, Graphics, Text } from 'pixi.js';
import { PHASES } from '@blackjack/shared';
import { createCardSprite } from './CardSprite.js';
import { AnimationQueue } from './AnimationQueue.js';

const CARD_HEIGHT = 130;
const CARD_GAP = 12;
const DEALER_Y = 30;
const PLAYER_Y = 290;
const LABEL_OFFSET_Y = -5;

const STACK_CARD_HEIGHT = 100;
const STACK_LAYER_OFFSET = 2; // px offset per card layer in the stack
const STACK_MAX_LAYERS = 5;   // visual cap for stacked cards

// Betting spot
const BET_CIRCLE_X = 50;
const BET_CIRCLE_Y = 370;
const BET_CIRCLE_RADIUS = 32;

/** Standard casino chip colours keyed by denomination */
const CHIP_COLORS = [
  { min: 100, fill: '#1a1a2e', stroke: '#e0e0e0', label: '#ffffff' },
  { min: 50,  fill: '#e67e22', stroke: '#f5c06d', label: '#ffffff' },
  { min: 25,  fill: '#27ae60', stroke: '#6dd5a0', label: '#ffffff' },
  { min: 10,  fill: '#2980b9', stroke: '#6db8e0', label: '#ffffff' },
  { min: 0,   fill: '#c0392b', stroke: '#e88a84', label: '#ffffff' },
];

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

    // Shoe (right side, upper half)
    this.shoeContainer = new Container();
    this.shoeContainer.x = this.app.screen.width - 120;
    this.shoeContainer.y = DEALER_Y + 20;
    this.root.addChild(this.shoeContainer);

    this.shoeLabel = new Text({ text: '', style: { fill: '#cccccc', fontSize: 13, fontFamily: 'sans-serif' } });
    this.shoeLabel.anchor = { x: 0.5, y: 0 };
    this.shoeLabel.x = this.app.screen.width - 120 + 35;
    this.shoeLabel.y = DEALER_Y + 20 + STACK_CARD_HEIGHT + 8;
    this.root.addChild(this.shoeLabel);

    // Discard pile (right side, lower half)
    this.discardContainer = new Container();
    this.discardContainer.x = this.app.screen.width - 120;
    this.discardContainer.y = PLAYER_Y + 20;
    this.root.addChild(this.discardContainer);

    this.discardLabel = new Text({ text: '', style: { fill: '#cccccc', fontSize: 13, fontFamily: 'sans-serif' } });
    this.discardLabel.anchor = { x: 0.5, y: 0 };
    this.discardLabel.x = this.app.screen.width - 120 + 35;
    this.discardLabel.y = PLAYER_Y + 20 + STACK_CARD_HEIGHT + 8;
    this.root.addChild(this.discardLabel);

    // Betting spot
    this.betContainer = new Container();
    this.betContainer.x = BET_CIRCLE_X;
    this.betContainer.y = BET_CIRCLE_Y;
    this.root.addChild(this.betContainer);

    this._currentBet = 0;
    this._drawBetSpot(0);

    /** Track what's currently rendered to diff against new state */
    this._renderedState = { dealerCards: [], playerCards: [], phase: null };
    this._shoeSize = 0;
    this._discardCount = 0;
    this._totalCards = 0;
  }

  /**
   * Draw the betting spot: an empty circle when no bet, a chip stack when active.
   * @param {number} amount
   */
  _drawBetSpot(amount) {
    this.betContainer.removeChildren();

    const g = new Graphics();

    if (amount <= 0) {
      // Empty betting circle
      g.circle(0, 0, BET_CIRCLE_RADIUS);
      g.stroke({ color: 'rgba(255,255,255,0.3)', width: 2 });
      // "BET" hint text
      const hint = new Text({
        text: 'BET',
        style: { fill: 'rgba(255,255,255,0.25)', fontSize: 13, fontFamily: 'sans-serif', fontWeight: 'bold' },
      });
      hint.anchor = { x: 0.5, y: 0.5 };
      this.betContainer.addChild(g, hint);
      return;
    }

    // Draw chip(s) for the active bet
    const chipStyle = CHIP_COLORS.find(c => amount >= c.min) || CHIP_COLORS[CHIP_COLORS.length - 1];

    // Outer circle (chip edge)
    g.circle(0, 0, BET_CIRCLE_RADIUS);
    g.fill(chipStyle.fill);
    g.circle(0, 0, BET_CIRCLE_RADIUS);
    g.stroke({ color: chipStyle.stroke, width: 3 });

    // Inner dashed-ring decoration (like a real chip)
    g.circle(0, 0, BET_CIRCLE_RADIUS - 7);
    g.stroke({ color: chipStyle.stroke, width: 1 });

    this.betContainer.addChild(g);

    // Bet amount label on the chip
    const label = new Text({
      text: `$${amount}`,
      style: {
        fill: chipStyle.label,
        fontSize: amount >= 1000 ? 12 : 14,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
      },
    });
    label.anchor = { x: 0.5, y: 0.5 };
    this.betContainer.addChild(label);
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
    // Betting circle outline on the felt
    g.circle(BET_CIRCLE_X, BET_CIRCLE_Y, BET_CIRCLE_RADIUS + 4);
    g.stroke({ color: 'rgba(255,255,255,0.12)', width: 1.5 });
    this.root.addChildAt(g, 0);
  }

  /**
   * Build or update a card-back stack visual (shoe or discard pile).
   * @param {Container} container
   * @param {number} count - number of cards in the stack
   * @returns {Promise<void>}
   */
  async _buildStack(container, count) {
    container.removeChildren();
    if (count <= 0) return;

    // Scale layers: more cards = more visible layers (up to max)
    const layers = Math.min(STACK_MAX_LAYERS, Math.max(1, Math.ceil(count / 60)));

    for (let i = 0; i < layers; i++) {
      const card = await createCardSprite(null, { height: STACK_CARD_HEIGHT });
      card.x = i * STACK_LAYER_OFFSET;
      card.y = (layers - 1 - i) * STACK_LAYER_OFFSET;
      container.addChild(card);
    }
  }

  /**
   * Update the shoe and discard pile visuals.
   * Total cards in play = shoe + on-table + discard (constant until reshuffle).
   *
   * @param {number} shoeSize
   * @param {number} cardsOnTable - total cards currently visible on the table
   */
  async _updateStacks(shoeSize, cardsOnTable) {
    // On first update or after a reshuffle (shoe grew), reset the total
    if (this._totalCards === 0 || shoeSize > this._shoeSize) {
      this._totalCards = shoeSize + cardsOnTable;
    }

    const discardCount = Math.max(0, this._totalCards - shoeSize - cardsOnTable);

    // Shoe
    if (shoeSize !== this._shoeSize) {
      this._shoeSize = shoeSize;
      await this._buildStack(this.shoeContainer, shoeSize);
    }
    this.shoeLabel.text = `Shoe: ${shoeSize}`;

    // Discard pile
    if (discardCount !== this._discardCount) {
      this._discardCount = discardCount;
      await this._buildStack(this.discardContainer, discardCount);
    }
    this.discardLabel.text = discardCount > 0 ? `Discard: ${discardCount}` : '';
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
    const showDealerHidden = phase === PHASES.PLAYER_TURN;
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

    // Update hand totals
    this._updateTotals(gameState);

    // Update betting spot
    const bet = gameState.currentBet || 0;
    if (bet !== this._currentBet) {
      this._currentBet = bet;
      this._drawBetSpot(bet);
    }

    // Update shoe and discard pile (counts visible cards including hidden placeholder)
    const cardsOnTable = dealerHand.cards.length + playerHand.cards.length +
      (showDealerHidden ? 1 : 0);
    this._updateStacks(gameState.shoeSize, cardsOnTable);
  }

  /**
   * Update the hand total displays.
   * @param {object} gameState
   */
  _updateTotals(gameState) {
    const { dealerHand, playerHand, phase } = gameState;

    // Player total
    if (playerHand.cards.length > 0) {
      const pLabel = playerHand.blackjack ? 'BJ' :
        playerHand.busted ? `${playerHand.total} BUST` :
        playerHand.soft ? `${playerHand.total} (soft)` :
        String(playerHand.total);
      this.playerTotal.text = pLabel;
    } else {
      this.playerTotal.text = '';
    }

    // Dealer total — hide during playerTurn (hidden card)
    if (dealerHand.cards.length > 0 && phase !== PHASES.PLAYER_TURN) {
      const dLabel = dealerHand.blackjack ? 'BJ' :
        dealerHand.busted ? `${dealerHand.total} BUST` :
        dealerHand.soft ? `${dealerHand.total} (soft)` :
        String(dealerHand.total);
      this.dealerTotal.text = dLabel;
    } else if (phase === PHASES.PLAYER_TURN && dealerHand.cards.length > 0) {
      // Show only the face-up card value
      this.dealerTotal.text = String(dealerHand.total);
    } else {
      this.dealerTotal.text = '';
    }
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

  /**
   * Remove all cards from the scene (e.g. new round).
   * @param {number} [shoeSize] - current shoe size to update the stacks
   */
  clear(shoeSize) {
    this.animationQueue.clear();
    this.dealerCards.removeChildren();
    this.playerCards.removeChildren();
    this._renderedState = { dealerCards: [], playerCards: [], phase: null };
    this._currentBet = 0;
    this._drawBetSpot(0);
    this.dealerTotal.text = '';
    this.playerTotal.text = '';

    if (shoeSize != null) {
      this._updateStacks(shoeSize, 0);
    }
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
