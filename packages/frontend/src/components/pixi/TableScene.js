import { Container, Graphics, Text } from 'pixi.js';
import { createCardSprite } from './CardSprite.js';
import { AnimationQueue } from './AnimationQueue.js';
import { BetSpot } from './BetSpot.js';
import { StackRenderer } from './StackRenderer.js';
import { diffGameState } from './tableDiff.js';
import { executeCommands } from './commandExecutor.js';
import { tween } from './tween.js';
import { SeatMarker, computeSeatPositions } from './SeatMarker.js';

const CARD_HEIGHT = 110;
const CARD_GAP = 12;
const STACK_CARD_HEIGHT = 80;

/**
 * All position constants for the table layout.
 * Canvas coordinate system is always 800x500.
 * Coordinates follow VISUAL_DESIGN_SPEC.md Section 2.
 */
const LAYOUT = {
  dealer: { cardsX: 400, cardsY: 140, labelX: 400, labelY: 72 },
  player: { cardsX: 400, cardsY: 310, labelX: 400, labelY: 290 },
  bet:    { x: 400, y: 435 },
  shoe:   { x: 720, y: 70 },
  discard: { x: 80, y: 70 },
  // Half-ellipse parameters for the table shape
  // Dealer edge: (40, 60) to (760, 60), player arc apex at (400, 460)
  table: { cx: 400, topY: 60, rx: 360, ry: 400 },
  // Half-ellipse parameters for seat distribution
  seats: { cx: 400, cy: 140, rx: 300, ry: 280 },
};

/**
 * TableScene manages the visual layout of the blackjack table on a PixiJS stage.
 * Implements the Renderer interface consumed by commandExecutor.
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

    // Felt background
    this._drawFelt();

    // Seat markers (NPC placeholders + player seat)
    this._seatMarkers = [];
    this._drawSeats(npcCount);

    // Hand total badges (pill-shaped, per spec Section 3.5)
    this.dealerTotal = this._createTotalBadge(LAYOUT.dealer.cardsX, LAYOUT.dealer.cardsY - 20);
    this.root.addChild(this.dealerTotal);

    this.playerTotal = this._createTotalBadge(LAYOUT.player.cardsX, LAYOUT.player.cardsY + CARD_HEIGHT + 12);
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

    // Shoe stack
    this.shoeStack = new StackRenderer(
      LAYOUT.shoe.x, LAYOUT.shoe.y,
      LAYOUT.shoe.x + 35, LAYOUT.shoe.y + STACK_CARD_HEIGHT + 8,
    );
    this.root.addChild(this.shoeStack.container);
    this.root.addChild(this.shoeStack.label);

    // Discard stack
    this.discardStack = new StackRenderer(
      LAYOUT.discard.x, LAYOUT.discard.y,
      LAYOUT.discard.x + 35, LAYOUT.discard.y + STACK_CARD_HEIGHT + 8,
    );
    this.root.addChild(this.discardStack.container);
    this.root.addChild(this.discardStack.label);

    // Betting spot
    this.betSpot = new BetSpot(LAYOUT.bet.x, LAYOUT.bet.y);
    this.root.addChild(this.betSpot.container);

    /** Track what's currently rendered to diff against new state */
    this._renderedState = { dealerCards: [], playerCards: [], phase: null };
    this._shoeSize = 0;
    this._totalCards = 0;
    this._discardCount = 0;
  }

  /**
   * Helper to trace the semi-circular table path on a Graphics context.
   * @param {Graphics} g
   * @param {number} cx @param {number} topY @param {number} rx @param {number} ry
   */
  _traceFeltPath(g, cx, topY, rx, ry) {
    const leftX = cx - rx;
    const rightX = cx + rx;
    g.moveTo(leftX, topY);
    g.lineTo(rightX, topY);
    g.quadraticCurveTo(rightX + 20, topY + ry * 0.6, cx, topY + ry);
    g.quadraticCurveTo(leftX - 20, topY + ry * 0.6, leftX, topY);
    g.closePath();
  }

  /**
   * Draw the semi-circular table felt per VISUAL_DESIGN_SPEC.md Section 1.
   * Layers: background → outer rim → felt fill → inner gold line → printed text.
   */
  _drawFelt() {
    const { cx, topY, rx, ry } = LAYOUT.table;
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // --- Background outside felt ---
    const bg = new Graphics();
    bg.rect(0, 0, W, H);
    bg.fill('#0a1f11');
    this.root.addChildAt(bg, 0);

    // --- Felt fill ---
    const felt = new Graphics();
    this._traceFeltPath(felt, cx, topY, rx, ry);
    felt.fill('#1a5c2a');
    this.root.addChild(felt);

    // --- Outer rim stroke (simulates wooden rail) ---
    const rim = new Graphics();
    this._traceFeltPath(rim, cx, topY, rx, ry);
    rim.stroke({ color: '#0d3318', width: 6 });
    this.root.addChild(rim);

    // --- Inner gold decorative line (inset 12px) ---
    const inset = 12;
    const irx = rx - inset;
    const iry = ry - inset;
    const itopY = topY + inset;
    const gold = new Graphics();
    this._traceFeltPath(gold, cx, itopY, irx, iry);
    gold.stroke({ color: 'rgba(255, 215, 0, 0.35)', width: 2 });
    this.root.addChild(gold);

    // --- Printed text on felt ---
    // "BLACKJACK PAYS 3 TO 2"
    const bjText = new Text({
      text: 'BLACKJACK PAYS 3 TO 2',
      style: {
        fill: 'rgba(255, 215, 0, 0.30)',
        fontSize: 16,
        fontFamily: 'Georgia, serif',
        fontWeight: 'bold',
        letterSpacing: 3,
      },
    });
    bjText.anchor = { x: 0.5, y: 0.5 };
    bjText.x = 400;
    bjText.y = 130;
    this.root.addChild(bjText);

    // "INSURANCE PAYS 2 TO 1"
    const insText = new Text({
      text: 'INSURANCE PAYS 2 TO 1',
      style: {
        fill: 'rgba(255, 215, 0, 0.22)',
        fontSize: 11,
        fontFamily: 'Georgia, serif',
        fontWeight: 'bold',
        letterSpacing: 2,
      },
    });
    insText.anchor = { x: 0.5, y: 0.5 };
    insText.x = 400;
    insText.y = 185;
    this.root.addChild(insText);

    // "DEALER"
    const dealerText = new Text({
      text: 'DEALER',
      style: {
        fill: 'rgba(255, 255, 255, 0.20)',
        fontSize: 11,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        letterSpacing: 4,
      },
    });
    dealerText.anchor = { x: 0.5, y: 0.5 };
    dealerText.x = 400;
    dealerText.y = 72;
    this.root.addChild(dealerText);

    // --- 7 Betting circle markings along the arc ---
    this._drawBettingCircles();
  }

  /**
   * Draw the 7 decorative betting circles along the player arc.
   * Per VISUAL_DESIGN_SPEC.md Section 2.1.
   */
  _drawBettingCircles() {
    /** @type {Array<{x: number, y: number, isPlayer: boolean}>} */
    const seats = [
      { x: 115, y: 330, isPlayer: false },
      { x: 185, y: 385, isPlayer: false },
      { x: 275, y: 420, isPlayer: false },
      { x: 400, y: 435, isPlayer: true },
      { x: 525, y: 420, isPlayer: false },
      { x: 615, y: 385, isPlayer: false },
      { x: 685, y: 330, isPlayer: false },
    ];

    const g = new Graphics();
    for (const seat of seats) {
      const color = seat.isPlayer
        ? 'rgba(255, 215, 0, 0.55)'
        : 'rgba(255, 215, 0, 0.25)';
      const width = seat.isPlayer ? 2.5 : 2;

      // Outer ring
      g.circle(seat.x, seat.y, 30);
      g.stroke({ color, width });
      // Inner ring
      g.circle(seat.x, seat.y, 22);
      g.stroke({ color, width: 1 });
    }
    this.root.addChild(g);
  }

  /**
   * Draw NPC placeholder seats and the player seat along the arc.
   * @param {number} npcCount
   */
  _drawSeats(npcCount) {
    // Clean up previous markers
    for (const marker of this._seatMarkers) {
      this.root.removeChild(marker.container);
    }
    this._seatMarkers = [];

    const totalSeats = 1 + npcCount;
    if (totalSeats <= 1) return; // No NPC seats to show if player is alone

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

  /**
   * Create a pill-shaped hand total badge (per spec Section 3.5).
   * @param {number} x @param {number} y
   * @returns {Container}
   */
  _createTotalBadge(x, y) {
    const container = new Container();
    container.x = x;
    container.y = y;

    const bg = new Graphics();
    container._bg = bg;
    container.addChild(bg);

    const label = new Text({
      text: '',
      style: {
        fill: '#ffd700',
        fontSize: 16,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
      },
    });
    label.anchor = { x: 0.5, y: 0.5 };
    container._label = label;
    container.addChild(label);

    container.visible = false;
    return container;
  }

  /**
   * Redraw a total badge pill background to fit the current text.
   * @param {Container} badge
   */
  _updateBadge(badge) {
    const label = badge._label;
    const bg = badge._bg;
    bg.clear();

    if (!label.text) {
      badge.visible = false;
      return;
    }

    badge.visible = true;
    const padX = 10;
    const padY = 3;
    const w = label.width + padX * 2;
    const h = label.height + padY * 2;

    bg.roundRect(-w / 2, -h / 2, w, h, 10);
    bg.fill('rgba(0, 0, 0, 0.60)');
    bg.roundRect(-w / 2, -h / 2, w, h, 10);
    bg.stroke({ color: 'rgba(255, 215, 0, 0.3)', width: 1 });

    // Color bust text red
    if (label.text === 'BUST') {
      label.style.fill = '#ff4444';
    } else {
      label.style.fill = '#ffd700';
    }
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
    this.playerTotal._label.text = text;
    this._updateBadge(this.playerTotal);
  }

  /** @param {string} text */
  updateDealerTotal(text) {
    this.dealerTotal._label.text = text;
    this._updateBadge(this.dealerTotal);
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
    this.dealerTotal._label.text = '';
    this._updateBadge(this.dealerTotal);
    this.playerTotal._label.text = '';
    this._updateBadge(this.playerTotal);

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
      await tween(sprite, { alpha: 1 }, 200, this.app);
      x += sprite.width + CARD_GAP;
    }

    if (appendHidden) {
      const hidden = await createCardSprite(null, { height: CARD_HEIGHT });
      hidden.x = x;
      hidden.y = 0;
      hidden.alpha = 0;
      container.addChild(hidden);
      await tween(hidden, { alpha: 1 }, 200, this.app);
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
      await tween(sprite, { alpha: 1 }, 200, this.app);
      x += sprite.width + CARD_GAP;
    }

    if (appendHidden) {
      const hidden = await createCardSprite(null, { height: CARD_HEIGHT });
      hidden.x = x;
      hidden.y = 0;
      hidden.alpha = 0;
      container.addChild(hidden);
      await tween(hidden, { alpha: 1 }, 200, this.app);
    }
  }
}
