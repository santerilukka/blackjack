import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { PHASES, ACTIONS, DEFAULT_BALANCE } from '@blackjack/shared';

let testUserCounter = 0;

/** Create a logged-in supertest agent. */
async function loggedInAgent(username) {
  const client = request.agent(app);
  if (!username) {
    testUserCounter++;
    username = `sessuser${testUserCounter}`;
  }
  await client.post('/api/login').send({ username });
  return client;
}

describe('POST /api/session', () => {
  it('creates a new session and returns 201', async () => {
    const client = await loggedInAgent();
    const res = await client.post('/api/session');

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.phase).toBe(PHASES.BETTING);
    expect(res.body.balance).toBe(DEFAULT_BALANCE);
    expect(res.body.playerHand.cards).toEqual([]);
    expect(res.body.dealerHand.cards).toEqual([]);
  });

  it('returns the same session on repeated calls', async () => {
    const client = await loggedInAgent();
    const res1 = await client.post('/api/session');
    const res2 = await client.post('/api/session');

    expect(res1.body.sessionId).toBe(res2.body.sessionId);
    // Second call returns 200 (existing), not 201
    expect(res2.status).toBe(200);
  });

  it('sets a session cookie', async () => {
    const client = await loggedInAgent();
    const res = await client.post('/api/session');
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/connect\.sid/);
  });

  it('returns 401 without login', async () => {
    const res = await request.agent(app).post('/api/session');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/session/state', () => {
  it('returns current game state', async () => {
    const client = await loggedInAgent();
    await client.post('/api/session');
    const res = await client.get('/api/session/state');

    expect(res.status).toBe(200);
    expect(res.body.phase).toBe(PHASES.BETTING);
    expect(res.body.balance).toBe(DEFAULT_BALANCE);
  });

  it('returns 404 without a game session (but logged in)', async () => {
    const client = await loggedInAgent();
    const res = await client.get('/api/session/state');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 without login', async () => {
    const res = await request.agent(app).get('/api/session/state');
    expect(res.status).toBe(401);
  });
});

describe('session-user balance linkage', () => {
  it('new session loads balance from user store', async () => {
    const username = `baluser${++testUserCounter}`;
    const client = await loggedInAgent(username);

    // Create session and play a round to change balance
    await client.post('/api/session');
    const betRes = await client.post('/api/bet').send({ amount: 100 });
    if (betRes.body.phase === PHASES.PLAYER_TURN) {
      await client.post('/api/action').send({ action: ACTIONS.STAND });
    }
    const resolvedState = await client.get('/api/session/state');
    const balanceAfterRound = resolvedState.body.balance;

    // Login again (clears game session) then create a new one
    await client.post('/api/login').send({ username });
    const newSessionRes = await client.post('/api/session');

    expect(newSessionRes.status).toBe(201);
    expect(newSessionRes.body.balance).toBe(balanceAfterRound);
  });

  it('/api/me reflects updated balance after gameplay', async () => {
    const username = `mebaluser${++testUserCounter}`;
    const client = await loggedInAgent(username);

    await client.post('/api/session');
    const betRes = await client.post('/api/bet').send({ amount: 100 });
    if (betRes.body.phase === PHASES.PLAYER_TURN) {
      await client.post('/api/action').send({ action: ACTIONS.STAND });
    }
    const stateRes = await client.get('/api/session/state');
    const gameBalance = stateRes.body.balance;

    const meRes = await client.get('/api/me');
    expect(meRes.body.balance).toBe(gameBalance);
  });
});
