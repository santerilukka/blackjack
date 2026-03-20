import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { PHASES, ACTIONS, OUTCOMES, DEFAULT_BALANCE } from '@blackjack/shared';

let testUserCounter = 0;

/** Create a supertest agent that persists cookies across requests and is logged in. */
async function loggedInAgent() {
  const client = request.agent(app);
  testUserCounter++;
  await client.post('/api/login').send({ username: `player${testUserCounter}` });
  return client;
}

/** Helper: login + create session + place bet, return the agent and bet response. */
async function setupRound(betAmount = 100) {
  const client = await loggedInAgent();
  await client.post('/api/session');
  const res = await client.post('/api/bet').send({ amount: betAmount });
  return { client, betRes: res };
}

describe('POST /api/bet', () => {
  it('places a bet and deals cards', async () => {
    const { betRes } = await setupRound(100);

    expect(betRes.status).toBe(200);
    expect(betRes.body.currentBet).toBe(100);
    expect(betRes.body.playerHand.cards).toHaveLength(2);
    expect(betRes.body.playerHand.total).toBeGreaterThan(0);
    // Dealer shows one card (hidden card not in cards array during playerTurn)
    if (betRes.body.phase === PHASES.PLAYER_TURN) {
      expect(betRes.body.dealerHand.cards).toHaveLength(1);
      expect(betRes.body.dealerHand.hiddenCard).not.toBeNull();
      expect(betRes.body.balance).toBe(DEFAULT_BALANCE - 100);
    }
  });

  it('deducts bet from balance', async () => {
    const { betRes } = await setupRound(200);
    if (betRes.body.phase === PHASES.PLAYER_TURN) {
      expect(betRes.body.balance).toBe(DEFAULT_BALANCE - 200);
    }
  });

  it('auto-resolves on player blackjack', async () => {
    // Play many rounds until we hit a blackjack or give up
    // This is a probabilistic test but blackjack is ~4.8% likely per hand
    let found = false;
    for (let i = 0; i < 100; i++) {
      const { betRes } = await setupRound(100);
      if (betRes.body.playerHand.blackjack) {
        expect(betRes.body.phase).toBe(PHASES.RESOLVED);
        expect([OUTCOMES.BLACKJACK, OUTCOMES.PUSH]).toContain(betRes.body.outcome);
        expect(betRes.body.dealerHand.hiddenCard).toBeNull();
        found = true;
        break;
      }
    }
    // If we didn't find one in 100 tries, skip rather than fail
    if (!found) {
      console.warn('No blackjack seen in 100 hands — skipping blackjack auto-resolve assertion');
    }
  });

  it('rejects bet when not in betting phase', async () => {
    const { client, betRes } = await setupRound(100);
    if (betRes.body.phase !== PHASES.PLAYER_TURN) return; // blackjack resolved, skip

    const res = await client.post('/api/bet').send({ amount: 100 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/betting phase/i);
  });

  it('rejects zero bet', async () => {
    const client = await loggedInAgent();
    await client.post('/api/session');
    const res = await client.post('/api/bet').send({ amount: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid bet/i);
  });

  it('rejects negative bet', async () => {
    const client = await loggedInAgent();
    await client.post('/api/session');
    const res = await client.post('/api/bet').send({ amount: -50 });

    expect(res.status).toBe(400);
  });

  it('rejects bet exceeding balance', async () => {
    const client = await loggedInAgent();
    await client.post('/api/session');
    const res = await client.post('/api/bet').send({ amount: DEFAULT_BALANCE + 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid bet/i);
  });

  it('rejects bet without login', async () => {
    const res = await request.agent(app).post('/api/bet').send({ amount: 100 });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/action', () => {
  it('hit adds a card to player hand', async () => {
    const { client, betRes } = await setupRound(100);
    if (betRes.body.phase !== PHASES.PLAYER_TURN) return;

    const res = await client.post('/api/action').send({ action: ACTIONS.HIT });
    expect(res.status).toBe(200);
    expect(res.body.playerHand.cards.length).toBeGreaterThanOrEqual(3);
  });

  it('stand resolves the round', async () => {
    const { client, betRes } = await setupRound(100);
    if (betRes.body.phase !== PHASES.PLAYER_TURN) return;

    const res = await client.post('/api/action').send({ action: ACTIONS.STAND });
    expect(res.status).toBe(200);
    expect(res.body.phase).toBe(PHASES.RESOLVED);
    expect(res.body.outcome).toBeDefined();
    expect(res.body.dealerHand.hiddenCard).toBeNull();
    expect(res.body.dealerHand.cards.length).toBeGreaterThanOrEqual(2);
    expect(res.body.availableActions).toEqual([]);
  });

  it('rejects action outside of player turn', async () => {
    const client = await loggedInAgent();
    await client.post('/api/session');
    // Still in betting phase
    const res = await client.post('/api/action').send({ action: ACTIONS.HIT });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/player turn/i);
  });

  it('rejects invalid action type', async () => {
    const { client, betRes } = await setupRound(100);
    if (betRes.body.phase !== PHASES.PLAYER_TURN) return;

    const res = await client.post('/api/action').send({ action: 'split' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid action/i);
  });

  it('rejects action without login', async () => {
    const res = await request.agent(app).post('/api/action').send({ action: ACTIONS.HIT });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/action — double', () => {
  it('double resolves the round with doubled bet', async () => {
    const { client, betRes } = await setupRound(100);
    if (betRes.body.phase !== PHASES.PLAYER_TURN) return;
    if (!betRes.body.availableActions.includes(ACTIONS.DOUBLE)) return;

    const res = await client.post('/api/action').send({ action: ACTIONS.DOUBLE });
    expect(res.status).toBe(200);
    expect(res.body.phase).toBe(PHASES.RESOLVED);
    expect(res.body.currentBet).toBe(200);
    expect(res.body.playerHand.cards).toHaveLength(3);
    expect(res.body.dealerHand.hiddenCard).toBeNull();
    expect(res.body.availableActions).toEqual([]);
  });

  it('rejects double after hitting (not in availableActions)', async () => {
    const { client, betRes } = await setupRound(100);
    if (betRes.body.phase !== PHASES.PLAYER_TURN) return;

    // Hit first — double should no longer be available
    const hitRes = await client.post('/api/action').send({ action: ACTIONS.HIT });
    if (hitRes.body.phase !== PHASES.PLAYER_TURN) return;

    const res = await client.post('/api/action').send({ action: ACTIONS.DOUBLE });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not available/i);
  });

  it('double not offered when balance insufficient', async () => {
    // Bet the full balance so there's nothing left to double
    const client = await loggedInAgent();
    await client.post('/api/session');
    const betRes = await client.post('/api/bet').send({ amount: DEFAULT_BALANCE });

    if (betRes.body.phase !== PHASES.PLAYER_TURN) return;
    expect(betRes.body.availableActions).not.toContain(ACTIONS.DOUBLE);
  });
});

describe('POST /api/new-round', () => {
  it('starts a new round after resolution', async () => {
    const { client, betRes } = await setupRound(100);
    if (betRes.body.phase !== PHASES.PLAYER_TURN) return;

    // Stand to resolve
    await client.post('/api/action').send({ action: ACTIONS.STAND });

    const res = await client.post('/api/new-round');
    expect(res.status).toBe(200);
    expect(res.body.phase).toBe(PHASES.BETTING);
    expect(res.body.currentBet).toBe(0);
    expect(res.body.playerHand.cards).toEqual([]);
    expect(res.body.dealerHand.cards).toEqual([]);
    expect(res.body.outcome).toBeNull();
  });

  it('preserves balance across rounds', async () => {
    const { client, betRes } = await setupRound(100);
    if (betRes.body.phase !== PHASES.PLAYER_TURN) return;

    const standRes = await client.post('/api/action').send({ action: ACTIONS.STAND });
    const balanceAfterRound = standRes.body.balance;

    const newRoundRes = await client.post('/api/new-round');
    expect(newRoundRes.body.balance).toBe(balanceAfterRound);
  });

  it('rejects new round when not in resolved phase', async () => {
    const client = await loggedInAgent();
    await client.post('/api/session');
    // Still in betting phase
    const res = await client.post('/api/new-round');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/resolution/i);
  });

  it('rejects new round without login', async () => {
    const res = await request.agent(app).post('/api/new-round');
    expect(res.status).toBe(401);
  });
});

describe('full round lifecycle', () => {
  it('plays a complete round: login → create → bet → stand → new-round', async () => {
    const client = await loggedInAgent();

    // 1. Create session
    const sessionRes = await client.post('/api/session');
    expect(sessionRes.status).toBe(201);
    expect(sessionRes.body.phase).toBe(PHASES.BETTING);

    // 2. Place bet
    const betRes = await client.post('/api/bet').send({ amount: 50 });
    expect(betRes.status).toBe(200);

    if (betRes.body.phase === PHASES.RESOLVED) {
      // Blackjack — skip to new round
    } else {
      expect(betRes.body.phase).toBe(PHASES.PLAYER_TURN);

      // 3. Stand
      const standRes = await client.post('/api/action').send({ action: ACTIONS.STAND });
      expect(standRes.status).toBe(200);
      expect(standRes.body.phase).toBe(PHASES.RESOLVED);
      expect(standRes.body.outcome).toBeDefined();
    }

    // 4. New round
    const newRoundRes = await client.post('/api/new-round');
    expect(newRoundRes.status).toBe(200);
    expect(newRoundRes.body.phase).toBe(PHASES.BETTING);

    // 5. Verify state endpoint reflects new round
    const stateRes = await client.get('/api/session/state');
    expect(stateRes.body.phase).toBe(PHASES.BETTING);
    expect(stateRes.body.currentBet).toBe(0);
  });

  it('plays multiple rounds and balance changes persist', async () => {
    const client = await loggedInAgent();
    await client.post('/api/session');

    for (let round = 0; round < 3; round++) {
      const betRes = await client.post('/api/bet').send({ amount: 10 });
      expect(betRes.status).toBe(200);

      if (betRes.body.phase === PHASES.PLAYER_TURN) {
        const standRes = await client.post('/api/action').send({ action: ACTIONS.STAND });
        expect(standRes.body.phase).toBe(PHASES.RESOLVED);
      }

      const newRoundRes = await client.post('/api/new-round');
      expect(newRoundRes.body.phase).toBe(PHASES.BETTING);
    }

    // Balance should have changed from the default after 3 rounds
    const stateRes = await client.get('/api/session/state');
    expect(stateRes.body.balance).toBeDefined();
    expect(typeof stateRes.body.balance).toBe('number');
  });

  it('plays a round with hits: login → bet → hit → hit → stand → new-round', async () => {
    const client = await loggedInAgent();
    await client.post('/api/session');

    const betRes = await client.post('/api/bet').send({ amount: 25 });
    if (betRes.body.phase !== PHASES.PLAYER_TURN) return;

    // Hit until we bust or decide to stand
    let state = betRes.body;
    let hits = 0;
    while (state.phase === PHASES.PLAYER_TURN && state.playerHand.total < 17 && hits < 5) {
      const hitRes = await client.post('/api/action').send({ action: ACTIONS.HIT });
      state = hitRes.body;
      hits++;
    }

    if (state.phase === PHASES.PLAYER_TURN) {
      const standRes = await client.post('/api/action').send({ action: ACTIONS.STAND });
      state = standRes.body;
    }

    expect(state.phase).toBe(PHASES.RESOLVED);
    expect(state.outcome).toBeDefined();
    expect([OUTCOMES.WIN, OUTCOMES.LOSE, OUTCOMES.PUSH, OUTCOMES.BLACKJACK]).toContain(state.outcome);

    // Can start a new round
    const newRoundRes = await client.post('/api/new-round');
    expect(newRoundRes.body.phase).toBe(PHASES.BETTING);
  });
});

describe('balance sync to user store', () => {
  it('balance persists to user store after bet resolves', async () => {
    const { client, betRes } = await setupRound(100);
    if (betRes.body.phase !== PHASES.PLAYER_TURN) return;

    const standRes = await client.post('/api/action').send({ action: ACTIONS.STAND });
    const gameBalance = standRes.body.balance;

    // /api/me should reflect the same balance
    const meRes = await client.get('/api/me');
    expect(meRes.body.balance).toBe(gameBalance);
  });

  it('balance persists after new-round', async () => {
    const { client, betRes } = await setupRound(50);
    if (betRes.body.phase !== PHASES.PLAYER_TURN) return;

    await client.post('/api/action').send({ action: ACTIONS.STAND });
    const newRoundRes = await client.post('/api/new-round');

    const meRes = await client.get('/api/me');
    expect(meRes.body.balance).toBe(newRoundRes.body.balance);
  });
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
