/**
 * @typedef {Object} RuleConfig
 * @property {number} num_decks - Number of decks in the shoe
 * @property {number} blackjack_payout - Net profit multiplier for blackjack (1.5 = 3:2, 1.2 = 6:5)
 * @property {boolean} dealer_hits_soft_17 - Whether dealer hits on soft 17 (H17)
 * @property {'none'|'late'|'early'} allow_surrender - Surrender availability
 * @property {boolean} allow_double_after_split - Whether doubling is allowed on split hands
 * @property {number} max_split_hands - Maximum number of hands from splitting (2-4)
 * @property {boolean} allow_resplit_aces - Whether re-splitting aces is allowed
 * @property {boolean} allow_hit_split_aces - Whether hitting after splitting aces is allowed
 * @property {'any_two_cards'|'9_10_11'|'10_11'} double_down_on - Which totals allow doubling
 * @property {boolean} split_requires_identical_rank - Whether split requires same rank (not just same value)
 * @property {number} penetration - Fraction of shoe dealt before reshuffle (0.0-1.0)
 */

/** @type {RuleConfig} */
export const DEFAULT_RULES = {
  num_decks: 6,
  blackjack_payout: 1.5,
  dealer_hits_soft_17: true,
  allow_surrender: 'late',
  allow_double_after_split: true,
  max_split_hands: 4,
  allow_resplit_aces: false,
  allow_hit_split_aces: false,
  double_down_on: 'any_two_cards',
  split_requires_identical_rank: true,
  penetration: 0.75,
};

/**
 * Create a rule config by merging overrides onto defaults.
 * @param {Partial<RuleConfig>} [overrides]
 * @returns {RuleConfig}
 */
export function createRules(overrides = {}) {
  return { ...DEFAULT_RULES, ...overrides };
}
