import { Howl, Howler } from 'howler';
import { SOUND_MAP } from './soundMap.js';

const STORAGE_KEY_VOLUME = 'bj_sound_volume';
const STORAGE_KEY_MUTED = 'bj_sound_muted';

/** @type {Map<string, Howl[]>} Lazily created Howl instances per sound group */
const howlCache = new Map();

/** @type {Map<string, number>} Last played variant index per group (for no-repeat) */
const lastPlayedIndex = new Map();

// --- Initialize from localStorage ---
let _volume = parseFloat(localStorage.getItem(STORAGE_KEY_VOLUME) ?? '0.7');
let _muted = localStorage.getItem(STORAGE_KEY_MUTED) === 'true';
if (Number.isNaN(_volume) || _volume < 0 || _volume > 1) _volume = 0.7;
Howler.volume(_volume);
Howler.mute(_muted);

/**
 * Get or lazily create the Howl instances for a sound group.
 * @param {string} eventName
 * @returns {Howl[]|null}
 */
function getHowls(eventName) {
  if (howlCache.has(eventName)) return howlCache.get(eventName);

  const paths = SOUND_MAP[eventName];
  if (!paths || paths.length === 0) return null;

  const howls = paths.map(src => new Howl({ src: [src], preload: true }));
  howlCache.set(eventName, howls);
  return howls;
}

/**
 * Pick a variant index that avoids immediate repeats (when 3+ variants exist).
 * @param {string} groupName
 * @param {number} count
 * @returns {number}
 */
function pickVariantIndex(groupName, count) {
  if (count <= 1) return 0;
  if (count === 2) return Math.floor(Math.random() * 2);

  const last = lastPlayedIndex.get(groupName) ?? -1;
  let next;
  do {
    next = Math.floor(Math.random() * count);
  } while (next === last);
  lastPlayedIndex.set(groupName, next);
  return next;
}

/**
 * Play a random variant from a sound group. Fire-and-forget.
 * @param {string} eventName - Key from SOUND_MAP
 */
export function play(eventName) {
  const howls = getHowls(eventName);
  if (!howls) return;

  const index = pickVariantIndex(eventName, howls.length);
  howls[index].play();
}

/**
 * Set master volume (0–1). Persists to localStorage.
 * @param {number} v
 */
export function setVolume(v) {
  _volume = Math.max(0, Math.min(1, v));
  Howler.volume(_volume);
  localStorage.setItem(STORAGE_KEY_VOLUME, String(_volume));
}

/** @returns {number} Current volume (0–1) */
export function getVolume() {
  return _volume;
}

/**
 * Toggle mute state. Persists to localStorage.
 * @returns {boolean} New muted state
 */
export function toggleMute() {
  _muted = !_muted;
  Howler.mute(_muted);
  localStorage.setItem(STORAGE_KEY_MUTED, String(_muted));
  return _muted;
}

/**
 * Set mute state explicitly.
 * @param {boolean} muted
 */
export function setMuted(muted) {
  _muted = muted;
  Howler.mute(_muted);
  localStorage.setItem(STORAGE_KEY_MUTED, String(_muted));
}

/** @returns {boolean} Current muted state */
export function isMuted() {
  return _muted;
}

/**
 * Preload all sound groups in the background.
 * Call once after app mounts to warm the cache.
 */
export function preloadAll() {
  for (const eventName of Object.keys(SOUND_MAP)) {
    getHowls(eventName);
  }
}
