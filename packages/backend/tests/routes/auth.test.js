import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { clearUsers } from '../../src/models/userManager.js';
import { DEFAULT_BALANCE } from '@blackjack/shared';

const agent = () => request.agent(app);

beforeEach(() => {
  clearUsers();
});

describe('POST /api/login', () => {
  it('registers a new user and returns 200', async () => {
    const res = await agent().post('/api/login').send({ username: 'alice' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
    expect(res.body.balance).toBe(DEFAULT_BALANCE);
  });

  it('returns existing user on second login', async () => {
    const client = agent();
    await client.post('/api/login').send({ username: 'bob' });
    const res = await client.post('/api/login').send({ username: 'bob' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('bob');
    expect(res.body.balance).toBe(DEFAULT_BALANCE);
  });

  it('normalizes username (trim + lowercase)', async () => {
    const res = await agent().post('/api/login').send({ username: '  Alice  ' });

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('alice');
  });

  it('sets a session cookie', async () => {
    const res = await agent().post('/api/login').send({ username: 'carol' });
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/connect\.sid/);
  });

  it('returns 400 when username is missing', async () => {
    const res = await agent().post('/api/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when body is empty', async () => {
    const res = await agent().post('/api/login').send();
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 for empty string username', async () => {
    const res = await agent().post('/api/login').send({ username: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 for username with special characters', async () => {
    const res = await agent().post('/api/login').send({ username: 'bad@name' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/letters/i);
  });

  it('returns 400 for username longer than 20 characters', async () => {
    const res = await agent().post('/api/login').send({ username: 'a'.repeat(21) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/20 characters/i);
  });

  it('clears stale game session on login', async () => {
    const client = agent();
    // Create a game session first
    await client.post('/api/login').send({ username: 'dave' });
    await client.post('/api/session');
    // Verify session exists
    const stateRes = await client.get('/api/session/state');
    expect(stateRes.status).toBe(200);

    // Login again — should clear game session
    await client.post('/api/login').send({ username: 'dave' });
    const afterRes = await client.get('/api/session/state');
    expect(afterRes.status).toBe(404);
  });
});

describe('GET /api/me', () => {
  it('returns 401 when not logged in', async () => {
    const res = await agent().get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns user data after login', async () => {
    const client = agent();
    await client.post('/api/login').send({ username: 'eve' });
    const res = await client.get('/api/me');

    expect(res.status).toBe(200);
    expect(res.body.username).toBe('eve');
    expect(res.body.balance).toBe(DEFAULT_BALANCE);
  });

  it('persists across requests with same session', async () => {
    const client = agent();
    await client.post('/api/login').send({ username: 'frank' });
    const res1 = await client.get('/api/me');
    const res2 = await client.get('/api/me');

    expect(res1.body.username).toBe('frank');
    expect(res2.body.username).toBe('frank');
  });
});

describe('POST /api/logout', () => {
  it('destroys the session', async () => {
    const client = agent();
    await client.post('/api/login').send({ username: 'grace' });

    const res = await client.post('/api/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out');

    // /api/me should now return 401
    const meRes = await client.get('/api/me');
    expect(meRes.status).toBe(401);
  });

  it('works even when not logged in', async () => {
    const res = await agent().post('/api/logout');
    expect(res.status).toBe(200);
  });
});
