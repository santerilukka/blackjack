/** Denomination → chip color mapping. Used by both PixiJS and React. */
export const CHIP_MAP = {
  5: 'red',
  10: 'lightblue',
  25: 'yellow',
  50: 'purple',
  100: 'black',
};

export const DENOMINATIONS = [100, 50, 25, 10, 5];

/** @param {number} denomination @returns {string} */
export function chipTopPath(denomination) {
  return `/chips/chip_${CHIP_MAP[denomination]}_top_large.png`;
}

/** @param {number} denomination @returns {string} */
export function chipFlatPath(denomination) {
  return `/chips/chip_${CHIP_MAP[denomination]}_flat_large.png`;
}
