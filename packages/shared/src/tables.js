/**
 * @typedef {Object} TableConfig
 * @property {string} id - Unique table identifier
 * @property {string} name - Display name
 * @property {string} description - Short description for the selection screen
 * @property {number} minBet - Minimum bet at this table
 * @property {number} maxBet - Maximum bet at this table
 * @property {number} maxPlayers - Max player seats (1 for solo, more for future multiplayer/NPC)
 * @property {Partial<import('./ruleConfig.js').RuleConfig>} [ruleOverrides] - Overrides merged onto DEFAULT_RULES
 */

/** @type {TableConfig[]} */
export const TABLES = [
  {
    id: 'classic-1v1',
    name: 'Classic Table',
    description: '1-on-1 with the dealer. Standard rules. 6-deck shoe.',
    minBet: 5,
    maxBet: 500,
    maxPlayers: 1,
    ruleOverrides: {},
  },
];
