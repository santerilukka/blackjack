import { Router } from 'express';
import { SHOP_ITEMS } from '@blackjack/shared';
import { getCosmetics, purchaseItem, equipItem } from '../models/userManager.js';

const router = Router();

/**
 * GET /api/shop — Return shop catalog and user's cosmetics state.
 */
router.get('/', (req, res) => {
  const cosmetics = getCosmetics(req.session.username);
  res.json({ items: SHOP_ITEMS, ...cosmetics });
});

/**
 * POST /api/shop/purchase — Purchase a shop item.
 * Body: { itemId: string }
 */
router.post('/purchase', (req, res) => {
  const { itemId } = req.body ?? {};
  if (!itemId || typeof itemId !== 'string') {
    return res.status(400).json({ error: 'itemId is required' });
  }

  try {
    const result = purchaseItem(req.session.username, itemId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/shop/equip — Equip an owned item.
 * Body: { itemId: string }
 */
router.post('/equip', (req, res) => {
  const { itemId } = req.body ?? {};
  if (!itemId || typeof itemId !== 'string') {
    return res.status(400).json({ error: 'itemId is required' });
  }

  try {
    const result = equipItem(req.session.username, itemId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export { router as shopRoutes };
