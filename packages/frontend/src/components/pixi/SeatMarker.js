import { Container, Graphics, Text } from 'pixi.js';

/**
 * Visual-only seat indicator placed along the player arc.
 * Shows a semi-transparent circle with label text.
 */
export class SeatMarker {
  /**
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {{ label?: string, radius?: number, isPlayer?: boolean }} [options]
   */
  constructor(x, y, { label = 'EMPTY', radius = 28, isPlayer = false } = {}) {
    this.container = new Container();
    this.container.x = x;
    this.container.y = y;

    const g = new Graphics();
    g.circle(0, 0, radius);
    if (isPlayer) {
      g.stroke({ color: 'rgba(255, 215, 0, 0.5)', width: 2 });
    } else {
      g.stroke({ color: 'rgba(255, 255, 255, 0.2)', width: 1.5 });
    }
    this.container.addChild(g);

    const text = new Text({
      text: label,
      style: {
        fill: isPlayer ? 'rgba(255, 215, 0, 0.6)' : 'rgba(255, 255, 255, 0.25)',
        fontSize: 11,
        fontFamily: 'sans-serif',
        fontWeight: 'bold',
      },
    });
    text.anchor = { x: 0.5, y: 0.5 };
    this.container.addChild(text);
  }
}

/**
 * Compute seat positions distributed along a half-ellipse (player arc).
 * The player seat is always at the center; NPC seats fill the remaining positions.
 *
 * @param {number} totalSeats - Total number of seats (1 player + npcCount)
 * @param {{ cx?: number, cy?: number, rx?: number, ry?: number }} [ellipse] - Ellipse parameters
 * @returns {Array<{ x: number, y: number, isPlayer: boolean }>}
 */
export function computeSeatPositions(totalSeats, { cx = 400, cy = 140, rx = 300, ry = 280 } = {}) {
  if (totalSeats <= 0) return [];

  // Distribute seats evenly along the bottom half of the ellipse (PI to 2*PI)
  // Angles go from left to right: PI (left) through 3*PI/2 (bottom) to 2*PI (right)
  const positions = [];
  const playerIndex = Math.floor(totalSeats / 2);

  for (let i = 0; i < totalSeats; i++) {
    // Evenly space angles from PI to 2*PI, with padding at edges
    const t = (i + 1) / (totalSeats + 1);
    const angle = Math.PI + t * Math.PI;

    positions.push({
      x: cx + rx * Math.cos(angle),
      y: cy - ry * Math.sin(angle),
      isPlayer: i === playerIndex,
    });
  }

  return positions;
}
