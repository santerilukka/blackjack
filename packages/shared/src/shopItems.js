/**
 * Shop item catalog — felt color themes.
 * Shared between backend (validation/pricing) and frontend (display).
 */

/** @typedef {{ id: string, name: string, price: number, colors: { fill: string, rim: string, bg: string } }} ShopItem */

/** @type {Record<string, ShopItem>} */
export const SHOP_ITEMS = {
  felt_green: {
    id: 'felt_green',
    name: 'Classic Green',
    price: 0,
    colors: { fill: '#1a5c2a', rim: '#0d3318', bg: '#0a1f11' },
  },
  felt_blue: {
    id: 'felt_blue',
    name: 'Royal Blue',
    price: 200,
    colors: { fill: '#1a3c6e', rim: '#0d1d40', bg: '#0a1530' },
  },
  felt_red: {
    id: 'felt_red',
    name: 'Wine Red',
    price: 200,
    colors: { fill: '#6e1a2a', rim: '#400d15', bg: '#300a11' },
  },
  felt_purple: {
    id: 'felt_purple',
    name: 'Purple Velvet',
    price: 300,
    colors: { fill: '#4a1a6e', rim: '#2a0d40', bg: '#1f0a30' },
  },
  felt_black: {
    id: 'felt_black',
    name: 'Midnight Black',
    price: 500,
    colors: { fill: '#1a1a1a', rim: '#0d0d0d', bg: '#080808' },
  },
};

export const DEFAULT_FELT = 'felt_green';

/**
 * Card back cosmetics — purchasable card back designs.
 * `frame` matches the spritesheet frame name.
 */

/** @typedef {{ id: string, name: string, price: number, frame: string }} CardBackItem */

/** @type {Record<string, CardBackItem>} */
export const CARD_BACK_ITEMS = {
  back_red_1: {
    id: 'back_red_1',
    name: 'Classic Red',
    price: 0,
    frame: 'back_red_1',
  },
  back_red_2: {
    id: 'back_red_2',
    name: 'Red Diamond',
    price: 150,
    frame: 'back_red_2',
  },
  back_blue_1: {
    id: 'back_blue_1',
    name: 'Royal Blue',
    price: 200,
    frame: 'back_blue_1',
  },
  back_blue_2: {
    id: 'back_blue_2',
    name: 'Blue Diamond',
    price: 200,
    frame: 'back_blue_2',
  },
  back_grey_1: {
    id: 'back_grey_1',
    name: 'Silver',
    price: 250,
    frame: 'back_grey_1',
  },
  back_grey_2: {
    id: 'back_grey_2',
    name: 'Grey Diamond',
    price: 250,
    frame: 'back_grey_2',
  },
};

export const DEFAULT_CARD_BACK = 'back_red_1';
