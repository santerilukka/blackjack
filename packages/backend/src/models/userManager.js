import { DEFAULT_BALANCE, DEFAULT_FELT, SHOP_ITEMS } from '@blackjack/shared';

/**
 * @typedef {Object} UserData
 * @property {string} username
 * @property {number} balance
 * @property {number} coins
 * @property {string[]} ownedItems - Item IDs the user has purchased
 * @property {string} activeFelt - Currently equipped felt item ID
 * @property {string} createdAt - ISO date string
 */

/** @type {Map<string, UserData>} */
const users = new Map();

const USERNAME_MAX_LENGTH = 20;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

/**
 * Validate and normalize a username.
 * @param {string} raw
 * @returns {string} normalized username
 * @throws {Error} if invalid
 */
export function normalizeUsername(raw) {
  if (typeof raw !== 'string') {
    throw new Error('Username must be a string');
  }
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0) {
    throw new Error('Username is required');
  }
  if (trimmed.length > USERNAME_MAX_LENGTH) {
    throw new Error('Username must be 20 characters or less');
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    throw new Error('Letters, numbers, and underscores only');
  }
  return trimmed;
}

/**
 * Find a user by username.
 * @param {string} username - already normalized
 * @returns {UserData | undefined}
 */
export function findUser(username) {
  return users.get(username);
}

/**
 * Create a new user with default balance.
 * @param {string} username - already normalized
 * @returns {UserData}
 */
export function createUser(username) {
  const user = {
    username,
    balance: DEFAULT_BALANCE,
    coins: 0,
    ownedItems: [DEFAULT_FELT],
    activeFelt: DEFAULT_FELT,
    createdAt: new Date().toISOString(),
  };
  users.set(username, user);
  return user;
}

/**
 * Log in an existing user or register a new one.
 * @param {string} rawUsername - raw input, will be validated/normalized
 * @returns {{ user: UserData, isNew: boolean }}
 * @throws {Error} if username is invalid
 */
export function loginOrRegister(rawUsername) {
  const username = normalizeUsername(rawUsername);
  const existing = findUser(username);
  if (existing) {
    return { user: existing, isNew: false };
  }
  const user = createUser(username);
  return { user, isNew: true };
}

/**
 * Update a user's stored balance.
 * @param {string} username
 * @param {number} balance
 */
export function updateBalance(username, balance) {
  const user = users.get(username);
  if (!user) {
    throw new Error(`User not found: ${username}`);
  }
  user.balance = balance;
}

/**
 * Get a user's current balance.
 * @param {string} username
 * @returns {number}
 */
export function getBalance(username) {
  const user = users.get(username);
  if (!user) {
    throw new Error(`User not found: ${username}`);
  }
  return user.balance;
}

/**
 * Get a user's cosmetics data.
 * @param {string} username
 * @returns {{ coins: number, ownedItems: string[], activeFelt: string }}
 */
export function getCosmetics(username) {
  const user = users.get(username);
  if (!user) throw new Error(`User not found: ${username}`);
  return { coins: user.coins, ownedItems: user.ownedItems, activeFelt: user.activeFelt };
}

/**
 * Add coins to a user's balance.
 * @param {string} username
 * @param {number} amount
 * @returns {number} updated coin balance
 */
export function addCoins(username, amount) {
  const user = users.get(username);
  if (!user) throw new Error(`User not found: ${username}`);
  user.coins += amount;
  return user.coins;
}

/**
 * Purchase a shop item. Validates ownership, price, and deducts coins.
 * Auto-equips the purchased item.
 * @param {string} username
 * @param {string} itemId
 * @returns {{ coins: number, ownedItems: string[], activeFelt: string }}
 */
export function purchaseItem(username, itemId) {
  const user = users.get(username);
  if (!user) throw new Error(`User not found: ${username}`);

  const item = SHOP_ITEMS[itemId];
  if (!item) throw new Error('Unknown item');
  if (user.ownedItems.includes(itemId)) throw new Error('Already owned');
  if (user.coins < item.price) throw new Error('Insufficient coins');

  user.coins -= item.price;
  user.ownedItems.push(itemId);
  user.activeFelt = itemId;

  return { coins: user.coins, ownedItems: user.ownedItems, activeFelt: user.activeFelt };
}

/**
 * Equip a shop item the user already owns.
 * @param {string} username
 * @param {string} itemId
 * @returns {{ activeFelt: string }}
 */
export function equipItem(username, itemId) {
  const user = users.get(username);
  if (!user) throw new Error(`User not found: ${username}`);

  if (!SHOP_ITEMS[itemId]) throw new Error('Unknown item');
  if (!user.ownedItems.includes(itemId)) throw new Error('Item not owned');

  user.activeFelt = itemId;
  return { activeFelt: user.activeFelt };
}

/**
 * Clear all users (for testing).
 */
export function clearUsers() {
  users.clear();
}
