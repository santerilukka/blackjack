/**
 * Position constants for the table layout.
 * Canvas coordinate system is always 1600x900.
 * Coordinates follow VISUAL_DESIGN_SPEC.md Section 2.
 */
export const LAYOUT = {
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

export const CARD_HEIGHT = 140;
export const CARD_OVERLAP = 44;
export const STACK_CARD_HEIGHT = 116;

/**
 * Compute the X position for a split hand given its index and total hand count.
 * Centers the group of hands around x=800 (canvas center).
 */
export function splitHandX(handIndex, handCount) {
  const spacing = 280;
  const totalWidth = (handCount - 1) * spacing;
  const startX = 800 - totalWidth / 2;
  return startX + handIndex * spacing;
}
