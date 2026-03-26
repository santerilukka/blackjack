import { Container, Graphics, Text } from 'pixi.js';
import { createCardSprite, getCardTexture, loadCardSpritesheet } from './CardSprite.js';
import { loadChipTextures, createTopChipSprite, decomposeIntoChips } from './ChipSprite.js';
import { AnimationQueue } from './AnimationQueue.js';
import { BetSpot } from './BetSpot.js';
import { StackRenderer } from './StackRenderer.js';
import { diffGameState } from './tableDiff.js';
import { executeCommands } from './commandExecutor.js';
import { tween, easeOutCubic, easeOutQuad } from './tween.js';
import { SeatMarker, computeSeatPositions } from './SeatMarker.js';

const CARD_HEIGHT = 140;
const CARD_OVERLAP = 44;
const STACK_CARD_HEIGHT = 116;

/**
 * Compute the X position for a split hand given its index and total hand count.
 * Centers the group of hands around x=800 (canvas center).
 */
function splitHandX(handIndex, handCount) {
  const spacing = 280;
  const totalWidth = (handCount - 1) * spacing;
  const startX = 800 - totalWidth / 2;
  return startX + handIndex * spacing;
}

/**
 * Find and remove a sprite matching a card's rank+suit from nested sprite groups.
 * Falls back to first available sprite if no exact match found.
 * @param {Array<Array<Sprite>>} spriteGroups
 * @param {{ rank: string, suit: string }} card
 * @returns {Sprite|null}
 */
function findAndRemoveSprite(spriteGroups, card) {
  for (const group of spriteGroups) {
    for (let j = 0; j < group.length; j++) {
      const s = group[j];
      if (s._cardRank === card.rank && s._cardSuit === card.suit) {
        group.splice(j, 1);
        return s;
      }
    }
  }
  // Fallback: take first available sprite from any group
  for (const group of spriteGroups) {
    if (group.length > 0) return group.shift();
  }
  return null;
}

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

    // Felt color config (defaults to Classic Green)
    this._feltColors = { fill: '#1a5c2a', rim: '#0d3318', bg: '#0a1f11' };
    this._feltGraphics = []; // references for redrawing

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

    this._currentMessage = '';

    // Split hand state
    this._splitContainers = []; // Array of { cards: Container, badge: Container, indicator: Graphics }
    this._isSplit = false;

    /** Track what's currently rendered to diff against new state */
    this._renderedState = { dealerCards: [], playerCards: [], playerHandCards: [], phase: null };
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
   * Uses this._feltColors for theming.
   */
  _drawFelt() {
    // Remove previous felt graphics if redrawing
    for (const obj of this._feltGraphics) {
      this.root.removeChild(obj);
      obj.destroy({ children: true });
    }
    this._feltGraphics = [];

    const { cx, topY, rx } = LAYOUT.table;
    const W = this.app.screen.width;
    const H = this.app.screen.height;
    const { fill, rim: rimColor, bg: bgColor } = this._feltColors;

    // --- Background outside felt ---
    const bg = new Graphics();
    bg.rect(0, 0, W, H);
    bg.fill(bgColor);
    this.root.addChildAt(bg, 0);
    this._feltGraphics.push(bg);

    // --- Felt fill ---
    const felt = new Graphics();
    this._traceFeltPath(felt, cx, topY, rx);
    felt.fill(fill);
    this.root.addChildAt(felt, 1);
    this._feltGraphics.push(felt);

    // --- Outer rim stroke (simulates wooden rail) ---
    const rim = new Graphics();
    this._traceFeltPath(rim, cx, topY, rx);
    rim.stroke({ color: rimColor, width: 6 });
    this.root.addChildAt(rim, 2);
    this._feltGraphics.push(rim);

    // --- Inner gold decorative line (inset 14px) ---
    const inset = 14;
    const gold = new Graphics();
    this._traceFeltPath(gold, cx, topY + inset, rx - inset);
    gold.stroke({ color: 'rgba(255, 215, 0, 0.35)', width: 2 });
    this.root.addChildAt(gold, 3);
    this._feltGraphics.push(gold);

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
    this.root.addChildAt(bjText, 4);
    this._feltGraphics.push(bjText);

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
    this.root.addChildAt(insText, 5);
    this._feltGraphics.push(insText);

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
    this.root.addChildAt(dealerText, 6);
    this._feltGraphics.push(dealerText);

    // --- 7 Betting circle markings along the arc ---
    const circleGraphics = this._drawBettingCircles();
    this._feltGraphics.push(circleGraphics);
  }

  /**
   * Draw the 7 decorative betting circles along the player arc.
   * Positions computed on the inner semicircular arc.
   * @returns {Graphics}
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
    this.root.addChildAt(g, 7);
    return g;
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
        fontSize: 26,
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
   * Create a small bet label for a split hand.
   * @param {number} x
   * @param {number} y
   * @returns {Container}
   */
  _createBetLabel(x, y) {
    const container = new Container();
    container.x = x;
    container.y = y;

    const bg = new Graphics();
    container._bg = bg;
    container.addChild(bg);

    const label = new Text({
      text: '',
      style: {
        fill: '#ffffff',
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
   * Update the bet label for a specific split hand.
   * @param {number} handIndex
   * @param {number} amount
   */
  updateSplitHandBet(handIndex, amount) {
    const entry = this._splitContainers[handIndex];
    if (!entry || !entry.betLabel) return;
    entry.betLabel._label.text = amount > 0 ? `$${amount}` : '';
    this._updateBadge(entry.betLabel);
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

  /** @deprecated Messages are now rendered in React DOM */
  showMessage() {}

  /** @deprecated Messages are now rendered in React DOM */
  hideMessage() {}

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

  // --- Split hand renderer methods ---

  /**
   * Initialize split mode: hide single-hand elements and create per-hand containers.
   * @param {number} handCount
   */
  initSplitMode(handCount) {
    // If already in split mode with the correct hand count, skip
    if (this._isSplit && this._splitContainers.length === handCount) return;

    // Clean up any existing split containers
    this.clearSplitMode();

    // Hide single-hand elements
    this.playerCards.visible = false;
    this.playerTotal.visible = false;

    for (let i = 0; i < handCount; i++) {
      const x = splitHandX(i, handCount);

      // Active-hand indicator (gold rounded rect behind cards)
      const indicator = new Graphics();
      indicator.roundRect(-80, -CARD_HEIGHT / 2 - 10, 160, CARD_HEIGHT + 20, 12);
      indicator.stroke({ color: 'rgba(255, 215, 0, 0.6)', width: 2.5 });
      indicator.fill('rgba(255, 215, 0, 0.08)');
      indicator.x = x;
      indicator.y = LAYOUT.player.cardsY;
      indicator.visible = false;
      this.root.addChild(indicator);

      // Card container
      const cards = new Container();
      cards.x = x;
      cards.y = LAYOUT.player.cardsY;
      this.root.addChild(cards);

      // Total badge
      const badge = this._createTotalBadge(x, LAYOUT.player.cardsY + CARD_HEIGHT / 2 + 16);
      this.root.addChild(badge);

      // Per-hand bet label
      const betLabel = this._createBetLabel(x, LAYOUT.player.cardsY + CARD_HEIGHT / 2 + 42);
      this.root.addChild(betLabel);

      this._splitContainers.push({ cards, badge, indicator, betLabel });
    }

    this._isSplit = true;
  }

  /**
   * Animate the split transition: slide existing pair cards apart, then deal new cards from shoe.
   * Handles both 'split-init' (genuinely new split) and 'split-relocate' (unchanged hand moving position).
   * @param {Array<{ handIndex: number, type: string, originalCard?: object, newCards?: Array, cards?: Array }>} layoutCmds
   */
  async animateSplitInit(layoutCmds) {
    const handCount = layoutCmds.length;

    // 1. Collect existing sprites from the correct source
    let existingSprites; // Array of arrays: one group per previous container

    if (this._isSplit) {
      // RE-SPLIT: sprites are in split containers
      existingSprites = this._splitContainers.map(entry => {
        const sprites = [...entry.cards.children];
        const containerX = entry.cards.x;
        const pivotX = entry.cards.pivot.x;
        entry.cards.removeChildren(); // detach without destroying
        for (const s of sprites) {
          s._globalX = containerX + s.x - pivotX;
          s._globalY = LAYOUT.player.cardsY + s.y;
        }
        return sprites;
      });
      // Now safe to destroy empty old containers
      this.clearSplitMode();
    } else {
      // FIRST SPLIT: sprites are in playerCards
      const sprites = [...this.playerCards.children];
      const pivotX = this.playerCards.pivot.x;
      this.playerCards.removeChildren();
      for (const s of sprites) {
        s._globalX = LAYOUT.player.cardsX + s.x - pivotX;
        s._globalY = LAYOUT.player.cardsY + s.y;
      }
      // Wrap each sprite as its own group (one card per hand for initial split)
      existingSprites = sprites.map(s => [s]);
    }

    // 2. Create new split layout
    this.initSplitMode(handCount);

    // 3. Transfer sprites to new containers
    for (let i = 0; i < layoutCmds.length; i++) {
      const cmd = layoutCmds[i];
      const splitContainer = this._splitContainers[i].cards;

      if (cmd.type === 'split-relocate') {
        // Transfer ALL matching sprites for this unchanged hand
        for (const card of cmd.cards) {
          const sprite = findAndRemoveSprite(existingSprites, card);
          if (!sprite) continue;
          sprite.x = sprite._globalX - splitContainer.x + splitContainer.pivot.x;
          sprite.y = sprite._globalY - splitContainer.y;
          splitContainer.addChild(sprite);
        }
        this._centerHand(splitContainer);
      } else {
        // split-init: transfer only the original card
        const sprite = findAndRemoveSprite(existingSprites, cmd.originalCard);
        if (!sprite) continue;

        sprite.x = sprite._globalX - splitContainer.x + splitContainer.pivot.x;
        sprite.y = sprite._globalY - splitContainer.y;
        splitContainer.addChild(sprite);
        this._centerHand(splitContainer);

        // Recalculate after pivot change
        sprite.x = sprite._globalX - splitContainer.x + splitContainer.pivot.x;
        sprite.y = sprite._globalY - splitContainer.y;
      }
    }

    // 4. Destroy leftover sprites that weren't reused
    for (const group of existingSprites) {
      for (const s of group) {
        s.destroy();
      }
    }

    // 5. Animate cards sliding to their target positions
    const slidePromises = layoutCmds.map((cmd, i) => {
      const container = this._splitContainers[i]?.cards;
      if (!container || container.children.length === 0) return Promise.resolve();

      // For relocated hands, slide all children; for split-init, slide only the first (original)
      if (cmd.type === 'split-relocate') {
        return Promise.all(container.children.map((sprite, j) => {
          const targetX = j * CARD_OVERLAP;
          const targetY = 0;
          return tween(sprite, { x: targetX, y: targetY }, 300, this.app, { easing: easeOutCubic });
        }));
      } else {
        const sprite = container.children[0];
        if (!sprite) return Promise.resolve();
        return tween(sprite, { x: 0, y: 0 }, 300, this.app, { easing: easeOutCubic });
      }
    });
    await Promise.all(slidePromises);

    // 6. Re-center relocated hands after slide (pivot may need adjustment)
    for (let i = 0; i < layoutCmds.length; i++) {
      if (layoutCmds[i].type === 'split-relocate') {
        this._centerHand(this._splitContainers[i].cards);
      }
    }

    // 7. Deal new cards from shoe to split-init hands only
    for (const cmd of layoutCmds) {
      if (cmd.type === 'split-init' && cmd.newCards && cmd.newCards.length > 0) {
        await this._addCards(this._splitContainers[cmd.handIndex].cards, cmd.newCards, false);
      }
    }
  }

  /**
   * Clean up split mode and restore single-hand elements.
   */
  clearSplitMode() {
    for (const { cards, badge, indicator, betLabel } of this._splitContainers) {
      this.root.removeChild(cards);
      this.root.removeChild(badge);
      this.root.removeChild(indicator);
      cards.destroy({ children: true });
      badge.destroy({ children: true });
      indicator.destroy();
      if (betLabel) {
        this.root.removeChild(betLabel);
        betLabel.destroy({ children: true });
      }
    }
    this._splitContainers = [];

    if (this._isSplit) {
      this.playerCards.visible = true;
      this.playerTotal.visible = true;
    }
    this._isSplit = false;
  }

  /**
   * Highlight the active split hand, dim settled/waiting hands.
   * @param {number} activeHandIndex
   * @param {Array} hands - playerHands array for settled status
   */
  setActiveHand(activeHandIndex, hands) {
    for (let i = 0; i < this._splitContainers.length; i++) {
      const { cards, indicator } = this._splitContainers[i];
      const hand = hands[i];

      if (i === activeHandIndex && !hand?.settled) {
        cards.alpha = 1.0;
        indicator.visible = true;
      } else if (hand?.settled) {
        cards.alpha = 0.6;
        indicator.visible = false;
      } else {
        cards.alpha = 0.8;
        indicator.visible = false;
      }
    }
  }

  /**
   * Add cards to a specific split hand.
   * @param {number} handIndex
   * @param {Array<{rank: string, suit: string}>} cards
   */
  async addSplitHandCards(handIndex, cards) {
    const container = this._splitContainers[handIndex]?.cards;
    if (!container) return;
    await this._addCards(container, cards, false);
  }

  /**
   * Full redraw of a specific split hand.
   * @param {number} handIndex
   * @param {Array<{rank: string, suit: string}>} cards
   */
  async redrawSplitHand(handIndex, cards) {
    const container = this._splitContainers[handIndex]?.cards;
    if (!container) return;
    await this._renderHand(container, cards, false);
  }

  /**
   * Update the total badge for a specific split hand.
   * @param {number} handIndex
   * @param {string} text
   */
  updateSplitHandTotal(handIndex, text) {
    const entry = this._splitContainers[handIndex];
    if (!entry) return;
    entry.badge._label.text = text;
    this._updateBadge(entry.badge);
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

  /**
   * Animate a chip flying from the bet spot to indicate a split bet.
   * The chip arcs upward from the bet area and lands near the split hand area.
   * @param {number} betAmount - the bet amount being duplicated
   * @returns {Promise<void>}
   */
  async animateSplitBet(betAmount) {
    const chips = decomposeIntoChips(betAmount);
    const topDenom = chips[0] || 5;
    const chipSize = 50;

    const sprite = createTopChipSprite(topDenom, { size: chipSize });
    sprite.x = LAYOUT.bet.x;
    sprite.y = LAYOUT.bet.y;
    sprite.alpha = 0.9;
    this.root.addChild(sprite);

    // Arc from bet spot upward toward player card area
    const targetX = LAYOUT.bet.x;
    const targetY = LAYOUT.bet.y - 80;

    await tween(sprite, { x: targetX, y: targetY, alpha: 0 }, 400, this.app, { easing: easeOutQuad });
    sprite.destroy();
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

    // Enqueue ALL updates through the animation queue so each diff sees the
    // state left by the previous animation (prevents race conditions on rapid updates).
    const renderer = this;
    this.animationQueue.enqueue(async () => {
      const diff = diffGameState(this._renderedState, gameState);
      const { dealerCmd, playerCmd, playerHandCmds, isSplit, activeHandIndex, handCount, showDealerHidden, newRenderedState } = diff;
      await executeCommands({ dealerCmd, playerCmd, playerHandCmds, isSplit, activeHandIndex, handCount, showDealerHidden, gameState }, renderer);
      this._renderedState = newRenderedState;
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
    this._updateBadge(this.dealerTotal);
    this.playerTotal._label.text = '';
    this._updateBadge(this.playerTotal);

    this._currentMessage = '';

    if (shoeSize != null) {
      this._updateStacksInternal(shoeSize, 0);
    }
  }

  /**
   * Apply a new felt color theme. Redraws the felt background layers.
   * @param {{ fill: string, rim: string, bg: string }} colors
   */
  applyFeltColors(colors) {
    this._feltColors = { ...colors };
    this._drawFelt();
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
      sprite._cardRank = card.rank;
      sprite._cardSuit = card.suit;
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
