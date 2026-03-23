import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeUsername,
  findUser,
  createUser,
  loginOrRegister,
  updateBalance,
  getBalance,
  clearUsers,
} from '../../src/models/userManager.js';
import { DEFAULT_BALANCE } from '@blackjack/shared';

beforeEach(() => {
  clearUsers();
});

describe('normalizeUsername', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalizeUsername('  Alice  ')).toBe('alice');
  });

  it('accepts alphanumeric and underscores', () => {
    expect(normalizeUsername('player_1')).toBe('player_1');
  });

  it('throws on empty string', () => {
    expect(() => normalizeUsername('')).toThrow('Username is required');
  });

  it('throws on whitespace-only string', () => {
    expect(() => normalizeUsername('   ')).toThrow('Username is required');
  });

  it('throws on non-string input', () => {
    expect(() => normalizeUsername(123)).toThrow('Username must be a string');
    expect(() => normalizeUsername(null)).toThrow('Username must be a string');
    expect(() => normalizeUsername(undefined)).toThrow('Username must be a string');
  });

  it('throws on username longer than 20 characters', () => {
    expect(() => normalizeUsername('a'.repeat(21))).toThrow('20 characters or less');
  });

  it('accepts username of exactly 20 characters', () => {
    expect(normalizeUsername('a'.repeat(20))).toBe('a'.repeat(20));
  });

  it('throws on special characters', () => {
    expect(() => normalizeUsername('user@name')).toThrow('Letters, numbers, and underscores only');
    expect(() => normalizeUsername('user name')).toThrow('Letters, numbers, and underscores only');
    expect(() => normalizeUsername('user-name')).toThrow('Letters, numbers, and underscores only');
  });
});

describe('createUser', () => {
  it('creates a user with default balance', () => {
    const user = createUser('alice');
    expect(user.username).toBe('alice');
    expect(user.balance).toBe(DEFAULT_BALANCE);
    expect(user.createdAt).toBeDefined();
  });
});

describe('findUser', () => {
  it('returns undefined for unknown username', () => {
    expect(findUser('nobody')).toBeUndefined();
  });

  it('returns the user after creation', () => {
    createUser('bob');
    const user = findUser('bob');
    expect(user).toBeDefined();
    expect(user.username).toBe('bob');
  });
});

describe('loginOrRegister', () => {
  it('creates a new user if username does not exist', () => {
    const { user, isNew } = loginOrRegister('charlie');
    expect(isNew).toBe(true);
    expect(user.username).toBe('charlie');
    expect(user.balance).toBe(DEFAULT_BALANCE);
  });

  it('returns existing user if username exists', () => {
    loginOrRegister('charlie');
    const { user, isNew } = loginOrRegister('charlie');
    expect(isNew).toBe(false);
    expect(user.username).toBe('charlie');
  });

  it('normalizes username before lookup', () => {
    loginOrRegister('  Dave  ');
    const { user, isNew } = loginOrRegister('dave');
    expect(isNew).toBe(false);
    expect(user.username).toBe('dave');
  });

  it('throws on invalid username', () => {
    expect(() => loginOrRegister('')).toThrow('Username is required');
    expect(() => loginOrRegister('bad@name')).toThrow('Letters, numbers, and underscores only');
  });
});

describe('updateBalance', () => {
  it('updates the stored balance', () => {
    createUser('eve');
    updateBalance('eve', 500);
    expect(getBalance('eve')).toBe(500);
  });

  it('throws if user does not exist', () => {
    expect(() => updateBalance('ghost', 100)).toThrow('User not found');
  });
});

describe('getBalance', () => {
  it('returns current balance', () => {
    createUser('frank');
    expect(getBalance('frank')).toBe(DEFAULT_BALANCE);
  });

  it('throws if user does not exist', () => {
    expect(() => getBalance('ghost')).toThrow('User not found');
  });

  it('reflects balance changes', () => {
    createUser('grace');
    updateBalance('grace', 0);
    expect(getBalance('grace')).toBe(0);
  });
});

describe('clearUsers', () => {
  it('removes all users', () => {
    createUser('one');
    createUser('two');
    clearUsers();
    expect(findUser('one')).toBeUndefined();
    expect(findUser('two')).toBeUndefined();
  });
});
