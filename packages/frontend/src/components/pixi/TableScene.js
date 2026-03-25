import { Container, Graphics, Text } from 'pixi.js';
import { createCardSprite, getCardTexture, loadCardSpritesheet } from './CardSprite.js';
import { loadChipTextures } from './ChipSprite.js';
import { AnimationQueue } from './AnimationQueue.js';
import { BetSpot } from './BetSpot.js';
import { StackRenderer } from './StackRenderer.js';
import { diffGameState } from './tableDiff.js';
import { executeCommands } from './commandExecutor.js';
import { tween, easeOutCubic, easeOutQuad } from './tween.js';
import { SeatMarker, computeSeatPositions } from './SeatMarker.js';

const CARD_HEIGHT = 120;
const CARD_OVERLAP = 38;
const STACK_CARD_HEIGHT = 100;

/**
 * All position constants for the table layout.
 * Canvas coordinate system is always 1600x900.
 * Coordinates follow VISUAL_DESIGN_SPEC.md Section 2.
 */
const LAYOUT = {
  dealer: { cardsX: 800, cardsY: 220, labelX: 800, labelY: 120 },
  player: { cardsX: 800, cardsY: 570, labelX: 800, labelY: 530 },
  bet:    { x: 800, y: 730 },
  shoe:   { x: 1460, y: 100 },
  discard: { x: 140, y: 100 },
  // Semicircle: flat edge at top, arc curves downward
  table: { cx: 800, topY: 20, rx: 770 },
  // Inner arc for seat distribution
  seats: { cx: 800, cy: 20, rx: 650, ry: 650 },
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

    // Preload card sprite sheet and chip textures so first deal/bet is instant
    loadCardSpritesheet();
    loadChipTextures();

    // Felt background
    this._drawFelt();

    // Seat markers (NPC placeholders + player seat)
    this._seatMarkers = [];
    this._drawSeats(npcCount);

    // Hand total badges (pill-shaped, per spec Section 3.5)
    this.dealerTotal = this._createTotalBadge(LAYOUT.dealer.cardsX, LAYOUT.dealer.cardsY - CARD_HEIGHT / 2 - 16);
    this.root.addChild(this.dealerTotal);

    this.playerTotal = this._createTotalBadge(LAYOUT.player.cardsX, LAYOUT.player.cardsY + CARD_HEIGHT / 2 + 16);
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

    /** Track what's currently rendered to diff against new state */
    this._renderedState = { dealerCards: [], playerCards: [], phase: null };
    this._shoeSize = 0;
    this._totalCards = 0;
    this._discardCount = 0;
  }

  /**
   * Trace a semicircular table path: flat edge at top, arc curving down.
   * Uses a true circular arc instead of Bézier approximation.
   * @param {Graphics} g
   * @param {number} cx - center X of the flat edge
   * @param {number} topY - Y coordinate of the flat edge
   * @param {number} r - radius of the semicircle
   */
  _traceFeltPath(g, cx, topY, r) {
    g.moveTo(cx - r, topY);
    g.lineTo(cx + r, topY);
    g.arc(cx, topY, r, 0, Math.PI);
    g.closePath();
  }

  /**
   * Draw the semi-circular table felt per VISUAL_DESIGN_SPEC.md Section 1.
   * Layers: background → outer rim → felt fill → inner gold line → printed text.
   */
  _drawFelt() {
    const { cx, topY, rx } = LAYOUT.table;
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // --- Background outside felt ---
    const bg = new Graphics();
    bg.rect(0, 0, W, H);
    bg.fill('#0a1f11');
    this.root.addChildAt(bg, 0);

    // --- Felt fill ---
    const felt = new Graphics();
    this._traceFeltPath(felt, cx, topY, rx);
    felt.fill('#1a5c2a');
    this.root.addChild(felt);

    // --- Outer rim stroke (simulates wooden rail) ---
    const rim = new Graphics();
    this._traceFeltPath(rim, cx, topY, rx);
    rim.stroke({ color: '#0d3318', width: 6 });
    this.root.addChild(rim);

    // --- Inner gold decorative line (inset 14px) ---
    const inset = 14;
    const gold = new Graphics();
    this._traceFeltPath(gold, cx, topY + inset, rx - inset);
    gold.stroke({ color: 'rgba(255, 215, 0, 0.35)', width: 2 });
    this.root.addChild(gold);

    // --- Printed text on felt ---
    // "BLACKJACK PAYS 3 TO 2"
    const bjText = new Text({
      text: 'BLACKJACK PAYS 3 TO 2',
      style: {
        fill: 'rgba(255, 215, 0, 0.30)',
        fontSize: 26,
        fontFamily: 'Georgia, serif',
        fontWeight: 'bold',
        letterSpacing: 4,
      },
    });
    bjText.anchor = { x: 0.5, y: 0.5 };
    bjText.x = cx;
    bjText.y = 155;
    this.root.addChild(bjText);

    // "INSURANCE PAYS 2 TO 1"
    const insText = new Text({
      text: 'INSURANCE PAYS 2 TO 1',
      style: {
        fill: 'rgba(255, 215, 0, 0.22)',
        fontSize: 18,
        fontFamily: 'Georgia, serif',
        fontWeight: 'bold',
        letterSpacing: 3,
      },
    });
    insText.anchor = { x: 0.5, y: 0.5 };
    insText.x = cx;
    insText.y = 300;
    this.root.addChild(insText);

    // "DEALER"
    const dealerText = new Text({
      text: 'DEALER',
      style: {
        fill: 'rgba(255, 255, 255, 0.20)',
        fontSize: 18,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
        letterSpacing: 5,
      },
    });
    dealerText.anchor = { x: 0.5, y: 0.5 };
    dealerText.x = cx;
    dealerText.y = 85;
    this.root.addChild(dealerText);

    // --- 7 Betting circle markings along the arc ---
    this._drawBettingCircles();
  }

  /**
   * Draw the 7 decorative betting circles along the player arc.
   * Positions computed on the inner semicircular arc.
   */
  _drawBettingCircles() {
    const { cx, cy, rx } = LAYOUT.seats;
    const angles = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(f => f * Math.PI);

    const seats = angles.map((a, i) => ({
      x: Math.round(cx + rx * Math.cos(a)),
      y: Math.round(cy + rx * Math.sin(a)),
      isPlayer: i === 3,
    }));

    const g = new Graphics();
    for (const seat of seats) {
      const color = seat.isPlayer
        ? 'rgba(255, 215, 0, 0.55)'
        : 'rgba(255, 215, 0, 0.25)';
      const width = seat.isPlayer ? 2.5 : 2;

      // Outer ring
      g.circle(seat.x, seat.y, 42);
      g.stroke({ color, width });
      // Inner ring
      g.circle(seat.x, seat.y, 32);
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
        fontSize: 22,
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

  /**
   * Flip the dealer's hidden card to reveal the actual card.
   * @param {number} index - Index of the card in the dealer container
   * @param {{ rank: string, suit: string }} card - The revealed card
   */
  async revealDealerCard(index, card) {
    const sprite = this.dealerCards.children[index];
    if (!sprite) return;

    const texture = await getCardTexture(card);

    // Squeeze to edge
    await tween(sprite, { scaleX: 0 }, 200, this.app, { easing: easeOutQuad });

    // Swap texture
    sprite.texture = texture;

    // Expand back to normal scale
    const targetScaleX = CARD_HEIGHT / texture.height;
    await tween(sprite, { scaleX: targetScaleX }, 200, this.app, { easing: easeOutQuad });
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

  /**
   * Add a single chip to the bet spot with animation (called from React during betting).
   * @param {number} denomination
   * @returns {Promise<void>}
   */
  addBetChip(denomination) {
    return this.betSpot.addChip(denomination, this.app);
  }

  /**
   * Clear all preview chips from the bet spot (called from React on "Clear Bets").
   */
  clearBetChips() {
    this.betSpot.clearChips();
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
        this._renderedState = newRenderedState;
      });
    } else {
      // No card changes, just update labels/stacks synchronously
      await executeCommands({ dealerCmd: null, playerCmd: null, showDealerHidden, gameState }, renderer);
      this._renderedState = newRenderedState;
    }
  }

  /**
   * Remove all cards from the scene (e.g. new round).
   * @param {number} [shoeSize]
   */
  clear(shoeSize) {
    this.animationQueue.clear();
    this.dealerCards.removeChildren();
    this.dealerCards.pivot.x = 0;
    this.playerCards.removeChildren();
    this.playerCards.pivot.x = 0;
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
   * Center a hand container's pivot so cards are centered around the container's position.
   * @param {Container} container
   */
  _centerHand(container) {
    const n = container.children.length;
    if (n === 0) {
      container.pivot.x = 0;
      return;
    }
    // Cards use center anchors and are placed at i * CARD_OVERLAP.
    // Visual center of all cards is at (n - 1) * CARD_OVERLAP / 2.
    container.pivot.x = (n - 1) * CARD_OVERLAP / 2;
  }

  /**
   * Full re-render of a hand (used for dealer reveal).
   * Cards are placed with overlapping fan layout.
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
   * Cards are placed with overlapping fan layout and re-centered.
   * @param {Container} container
   * @param {Array<{rank: string, suit: string}>} newCards
   * @param {boolean} appendHidden
   */
  async _addCards(container, newCards, appendHidden) {
    let i = container.children.length;

    for (const card of newCards) {
      const sprite = await createCardSprite(card, { height: CARD_HEIGHT });
      const targetX = i * CARD_OVERLAP;
      const targetY = 0;

      // Place at shoe position in container-local coords
      sprite.x = LAYOUT.shoe.x - container.x + container.pivot.x;
      sprite.y = LAYOUT.shoe.y - container.y;
      sprite.alpha = 0;
      container.addChild(sprite);
      this._centerHand(container);

      // Recompute start position after pivot change
      sprite.x = LAYOUT.shoe.x - container.x + container.pivot.x;
      sprite.y = LAYOUT.shoe.y - container.y;

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

      await tween(hidden, { x: targetX, y: targetY, alpha: 1 }, 350, this.app, { easing: easeOutCubic });
    }
  }
}
