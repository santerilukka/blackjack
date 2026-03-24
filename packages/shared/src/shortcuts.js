/**
 * Single source of truth for keyboard shortcuts.
 * Each entry maps a shortcut ID to its key, label (for <kbd>), and description.
 */
export const SHORTCUTS = {
  HIT:        { key: 'h', label: 'H', description: 'Hit' },
  STAND:      { key: 's', label: 'S', description: 'Stand' },
  DOUBLE:     { key: 'd', label: 'D', description: 'Double' },
  SPLIT:      { key: 'p', label: 'P', description: 'Split' },
  SURRENDER:  { key: 'r', label: 'R', description: 'Surrender' },
  INSURANCE_YES: { key: 'y', label: 'Y', description: 'Accept insurance' },
  INSURANCE_NO:  { key: 'n', label: 'N', description: 'Decline insurance' },
  BET:        { key: 'b', label: 'B', description: 'Place bet / deal' },
  NEW_ROUND:  { key: 'n', label: 'N', description: 'New round' },
  MENU:       { key: 'm', label: 'M', description: 'Toggle menu' },
  CLOSE_MENU: { key: 'escape', label: 'Esc', description: 'Close menu' },
  LOGOUT:     { key: 'l', label: 'L', description: 'Log out (in menu)' },
};

/** Chip selection uses number keys 1-5 */
export const CHIP_SHORTCUT_DESCRIPTION = 'Select chip ($5-$100)';
