import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { PHASES, DEFAULT_BALANCE } from '@blackjack/shared';

/** Create a supertest agent that persists cookies across requests. */
const agent = () => request.agent(app);

describe('POST /api/session', () => {
  it('creates a new session and returns 201', async () => {
    const res = await agent().post('/api/session');

    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.phase).toBe(PHASES.BETTING);
    expect(res.body.balance).toBe(DEFAULT_BALANCE);
    expect(res.body.playerHand.cards).toEqual([]);
    expect(res.body.dealerHand.cards).toEqual([]);
  });

  it('returns the same session on repeated calls', async () => {
    const client = agent();
    const res1 = await client.post('/api/session');
    const res2 = await client.post('/api/session');

    expect(res1.body.sessionId).toBe(res2.body.sessionId);
    // Second call returns 200 (existing), not 201
    expect(res2.status).toBe(200);
  });

  it('sets a session cookie', async () => {
    const res = await agent().post('/api/session');
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/connect\.sid/);
  });
});

describe('GET /api/session/state', () => {
  it('returns current game state', async () => {
    const client = agent();
    await client.post('/api/session');
    const res = await client.get('/api/session/state');

    expect(res.status).toBe(200);
    expect(res.body.phase).toBe(PHASES.BETTING);
    expect(res.body.balance).toBe(DEFAULT_BALANCE);
  });

  it('returns 404 without a session', async () => {
    const res = await agent().get('/api/session/state');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
