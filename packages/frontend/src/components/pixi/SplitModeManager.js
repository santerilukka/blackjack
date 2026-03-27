import { Container, Graphics } from 'pixi.js';
import { LAYOUT, CARD_HEIGHT, CARD_OVERLAP, splitHandX } from './tableLayout.js';
import { createTotalBadge } from './BadgeRenderer.js';
import { BetSpot } from './BetSpot.js';
import { tween, easeOutCubic } from './tween.js';

/**
 * Find and remove a sprite matching a card's rank+suit from nested sprite groups.
 * Falls back to first available sprite if no exact match found.
 * @param {Array<Array<import('pixi.js').Sprite>>} spriteGroups
 * @param {{ rank: string, suit: string }} card
 * @returns {import('pixi.js').Sprite|null}
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
  for (const group of spriteGroups) {
    if (group.length > 0) return group.shift();
  }
  return null;
}

/**
 * Manages split-hand mode: creating per-hand containers, animating splits,
 * highlighting active hands, and cleanup.
 */
export class SplitModeManager {
  /**
   * @param {import('pixi.js').Container} root
   * @param {import('pixi.js').Application} app
   * @param {{ centerHand: (container: Container) => void, addCards: (container: Container, cards: Array, hidden: boolean) => Promise<void> }} helpers
   */
  constructor(root, app, helpers) {
    this._root = root;
    this._app = app;
    this._centerHand = helpers.centerHand;
    this._addCards = helpers.addCards;

    /** @type {Array<{ cards: Container, badge: Container, indicator: Graphics, betSpot: BetSpot }>} */
    this.containers = [];
    this.isSplit = false;
  }

  /**
   * Initialize split mode: create per-hand containers.
   * @param {number} handCount
   * @param {{ playerCards: Container, playerTotal: Container, betSpot: BetSpot }} singleHandElements
   */
  init(handCount, singleHandElements) {
    if (this.isSplit && this.containers.length === handCount) return;

    this.clear(singleHandElements);

    singleHandElements.playerCards.visible = false;
    singleHandElements.playerTotal.visible = false;

    for (let i = 0; i < handCount; i++) {
      const x = splitHandX(i, handCount);

      const indicator = new Graphics();
      indicator.roundRect(-80, -CARD_HEIGHT / 2 - 10, 160, CARD_HEIGHT + 20, 12);
      indicator.stroke({ color: 'rgba(255, 215, 0, 0.6)', width: 2.5 });
      indicator.fill('rgba(255, 215, 0, 0.08)');
      indicator.x = x;
      indicator.y = LAYOUT.player.cardsY;
      indicator.visible = false;
      this._root.addChild(indicator);

      const cards = new Container();
      cards.x = x;
      cards.y = LAYOUT.player.cardsY;
      this._root.addChild(cards);

      const badge = createTotalBadge(x, LAYOUT.player.cardsY + CARD_HEIGHT / 2 + 16);
      this._root.addChild(badge);

      const betSpot = new BetSpot(x, LAYOUT.bet.y);
      this._root.addChild(betSpot.container);

      this.containers.push({ cards, badge, indicator, betSpot });
    }

    this.isSplit = true;
    singleHandElements.betSpot.container.visible = false;
  }

  /**
   * Animate the split transition: slide existing cards apart, then deal new cards.
   * @param {Array<{ handIndex: number, type: string, originalCard?: object, newCards?: Array, cards?: Array }>} layoutCmds
   * @param {number} perHandBet
   * @param {{ playerCards: Container, playerTotal: Container, betSpot: BetSpot }} singleHandElements
   */
  async animateSplitInit(layoutCmds, perHandBet, singleHandElements) {
    const handCount = layoutCmds.length;

    // 1. Collect existing sprites from the correct source
    let existingSprites;

    if (this.isSplit) {
      existingSprites = this.containers.map(entry => {
        const sprites = [...entry.cards.children];
        const containerX = entry.cards.x;
        const pivotX = entry.cards.pivot.x;
        entry.cards.removeChildren();
        for (const s of sprites) {
          s._globalX = containerX + s.x - pivotX;
          s._globalY = LAYOUT.player.cardsY + s.y;
        }
        return sprites;
      });
      this.clear(singleHandElements);
    } else {
      const sprites = [...singleHandElements.playerCards.children];
      const pivotX = singleHandElements.playerCards.pivot.x;
      singleHandElements.playerCards.removeChildren();
      for (const s of sprites) {
        s._globalX = LAYOUT.player.cardsX + s.x - pivotX;
        s._globalY = LAYOUT.player.cardsY + s.y;
      }
      existingSprites = sprites.map(s => [s]);
    }

    // 2. Create new split layout
    this.init(handCount, singleHandElements);

    // 3. Transfer sprites to new containers
    for (let i = 0; i < layoutCmds.length; i++) {
      const cmd = layoutCmds[i];
      const splitContainer = this.containers[i].cards;

      if (cmd.type === 'split-relocate') {
        for (const card of cmd.cards) {
          const sprite = findAndRemoveSprite(existingSprites, card);
          if (!sprite) continue;
          sprite.x = sprite._globalX - splitContainer.x + splitContainer.pivot.x;
          sprite.y = sprite._globalY - splitContainer.y;
          splitContainer.addChild(sprite);
        }
        this._centerHand(splitContainer);
      } else {
        const sprite = findAndRemoveSprite(existingSprites, cmd.originalCard);
        if (!sprite) continue;

        sprite.x = sprite._globalX - splitContainer.x + splitContainer.pivot.x;
        sprite.y = sprite._globalY - splitContainer.y;
        splitContainer.addChild(sprite);
        this._centerHand(splitContainer);

        sprite.x = sprite._globalX - splitContainer.x + splitContainer.pivot.x;
        sprite.y = sprite._globalY - splitContainer.y;
      }
    }

    // 4. Destroy leftover sprites
    for (const group of existingSprites) {
      for (const s of group) s.destroy();
    }

    // 5. Animate cards and chips sliding to target positions
    const slidePromises = layoutCmds.map((cmd, i) => {
      const container = this.containers[i]?.cards;
      if (!container || container.children.length === 0) return Promise.resolve();

      if (cmd.type === 'split-relocate') {
        return Promise.all(container.children.map((sprite, j) => {
          const targetX = j * CARD_OVERLAP;
          const targetY = 0;
          return tween(sprite, { x: targetX, y: targetY }, 300, this._app, { easing: easeOutCubic });
        }));
      } else {
        const sprite = container.children[0];
        if (!sprite) return Promise.resolve();
        return tween(sprite, { x: 0, y: 0 }, 300, this._app, { easing: easeOutCubic });
      }
    });

    if (perHandBet > 0 && this.containers[0]?.betSpot) {
      const firstEntry = this.containers[0];
      const targetX = splitHandX(0, handCount);
      firstEntry.betSpot.container.x = LAYOUT.bet.x;
      firstEntry.betSpot.update(perHandBet);
      slidePromises.push(
        tween(firstEntry.betSpot.container, { x: targetX }, 350, this._app, { easing: easeOutCubic })
      );
    }

    await Promise.all(slidePromises);

    if (perHandBet > 0) {
      const flingPromises = [];
      for (let i = 1; i < handCount; i++) {
        const entry = this.containers[i];
        if (!entry?.betSpot) continue;
        flingPromises.push(entry.betSpot.flingChips(perHandBet, this._app));
      }
      await Promise.all(flingPromises);
    }

    // 6. Re-center relocated hands
    for (let i = 0; i < layoutCmds.length; i++) {
      if (layoutCmds[i].type === 'split-relocate') {
        this._centerHand(this.containers[i].cards);
      }
    }

    // 7. Deal new cards to split-init hands
    for (const cmd of layoutCmds) {
      if (cmd.type === 'split-init' && cmd.newCards && cmd.newCards.length > 0) {
        await this._addCards(this.containers[cmd.handIndex].cards, cmd.newCards, false);
      }
    }
  }

  /**
   * Clean up split mode and restore single-hand elements.
   * @param {{ playerCards: Container, playerTotal: Container, betSpot: BetSpot }} singleHandElements
   */
  clear(singleHandElements) {
    for (const { cards, badge, indicator, betSpot } of this.containers) {
      this._root.removeChild(cards);
      this._root.removeChild(badge);
      this._root.removeChild(indicator);
      cards.destroy({ children: true });
      badge.destroy({ children: true });
      indicator.destroy();
      if (betSpot) {
        this._root.removeChild(betSpot.container);
        betSpot.container.destroy({ children: true });
      }
    }
    this.containers = [];

    if (this.isSplit) {
      singleHandElements.playerCards.visible = true;
      singleHandElements.playerTotal.visible = true;
      singleHandElements.betSpot.container.visible = true;
    }
    this.isSplit = false;
  }

  /**
   * Highlight the active split hand, dim settled/waiting hands.
   */
  setActiveHand(activeHandIndex, hands) {
    for (let i = 0; i < this.containers.length; i++) {
      const { cards, indicator } = this.containers[i];
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

  /** Add cards to a specific split hand. */
  async addSplitHandCards(handIndex, cards) {
    const container = this.containers[handIndex]?.cards;
    if (!container) return;
    await this._addCards(container, cards, false);
  }

  /** Full redraw of a specific split hand. */
  async redrawSplitHand(handIndex, cards, renderHand) {
    const container = this.containers[handIndex]?.cards;
    if (!container) return;
    await renderHand(container, cards, false);
  }

  /** Update the total badge for a specific split hand. */
  updateSplitHandTotal(handIndex, text, updateBadgeFn) {
    const entry = this.containers[handIndex];
    if (!entry) return;
    entry.badge._label.text = text;
    updateBadgeFn(entry.badge);
  }

  /** Update the bet label for a specific split hand. */
  updateSplitHandBet(handIndex, amount) {
    const entry = this.containers[handIndex];
    if (!entry?.betSpot) return;
    entry.betSpot.update(amount);
  }
}
