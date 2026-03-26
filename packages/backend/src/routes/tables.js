import { Router } from 'express';
import { getAllTables } from '../models/tableManager.js';

const router = Router();

/** GET /api/tables — List available tables. */
router.get('/tables', (req, res) => {
  res.json(getAllTables());
});

export { router as tableRoutes };
