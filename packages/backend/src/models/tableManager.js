import { TABLES, createRules } from '@blackjack/shared';

/** @returns {import('@blackjack/shared').TableConfig[]} */
export function getAllTables() {
  return TABLES;
}

/**
 * @param {string} tableId
 * @returns {import('@blackjack/shared').TableConfig | undefined}
 */
export function getTable(tableId) {
  return TABLES.find((t) => t.id === tableId);
}

/**
 * @param {string} tableId
 * @returns {import('@blackjack/shared').RuleConfig}
 */
export function getTableRules(tableId) {
  const table = getTable(tableId);
  return createRules(table?.ruleOverrides ?? {});
}
