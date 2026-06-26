// Persistence for scores + names.
//
// Two backends, chosen automatically:
//   • Upstash Redis (when UPSTASH_REDIS_REST_* are set) — survives restarts on
//     ephemeral hosts like Render free. The whole DB is one JSON blob.
//   • Local JSON file (data/scores.json) — for local development.
//
// All functions are async. A small in-process lock serializes read-modify-write
// so concurrent webhooks can't clobber each other (Render free = single instance).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'scores.json');
const REDIS_KEY = 'pips-bot:db';

const useRedis = Boolean(config.redisUrl && config.redisToken);
const empty = () => ({ names: {}, scores: [] });

export function backendName() {
  return useRedis ? 'upstash-redis' : 'local-file';
}

// --- Upstash Redis REST: POST a command as a JSON array, get { result }. ---
async function redisCommand(cmd) {
  const res = await fetch(config.redisUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.redisToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) {
    throw new Error(`Upstash ${cmd[0]} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()).result;
}

async function load() {
  if (useRedis) {
    const raw = await redisCommand(['GET', REDIS_KEY]);
    if (!raw) return empty();
    try {
      return JSON.parse(raw);
    } catch {
      return empty();
    }
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return empty();
  }
}

async function save(db) {
  if (useRedis) {
    await redisCommand(['SET', REDIS_KEY, JSON.stringify(db)]);
    return;
  }
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// Serialize all store operations to avoid read-modify-write races.
let chain = Promise.resolve();
function withLock(fn) {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

function maskNumber(phone) {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 4 ? `...${digits.slice(-4)}` : phone;
}

/** Set a player's display name (keyed by phone number). */
export function setName(phone, name) {
  return withLock(async () => {
    const db = await load();
    db.names[phone] = name;
    await save(db);
  });
}

/** Display name for a phone, falling back to a masked number. */
export function getName(phone) {
  return withLock(async () => {
    const db = await load();
    return db.names[phone] || maskNumber(phone);
  });
}

/**
 * Record a score. One best (fastest) time is kept per phone+puzzle+difficulty.
 * @returns {Promise<{added:boolean, improved:boolean, previous?:number}>}
 */
export function addScore({ phone, puzzle, difficulty, seconds, timeStr }) {
  return withLock(async () => {
    const db = await load();
    const existing = db.scores.find(
      (s) => s.phone === phone && s.puzzle === puzzle && s.difficulty === difficulty
    );

    if (!existing) {
      db.scores.push({ phone, puzzle, difficulty, seconds, timeStr, at: new Date().toISOString() });
      await save(db);
      return { added: true, improved: false };
    }

    if (seconds < existing.seconds) {
      const previous = existing.seconds;
      existing.seconds = seconds;
      existing.timeStr = timeStr;
      existing.at = new Date().toISOString();
      await save(db);
      return { added: false, improved: true, previous };
    }

    return { added: false, improved: false, previous: existing.seconds };
  });
}

/** The most recent (highest) puzzle number anyone has logged, or null. */
export function latestPuzzle() {
  return withLock(async () => {
    const db = await load();
    if (db.scores.length === 0) return null;
    return Math.max(...db.scores.map((s) => s.puzzle));
  });
}

/**
 * Standings for one puzzle: { Easy: [...], Medium: [...], Hard: [...] }
 * Each entry: { phone, name, seconds, timeStr }, sorted fastest first.
 */
export function leaderboard(puzzle) {
  return withLock(async () => {
    const db = await load();
    const byDifficulty = { Easy: [], Medium: [], Hard: [] };
    for (const s of db.scores) {
      if (s.puzzle !== puzzle) continue;
      if (!byDifficulty[s.difficulty]) continue;
      byDifficulty[s.difficulty].push({
        phone: s.phone,
        name: db.names[s.phone] || maskNumber(s.phone),
        seconds: s.seconds,
        timeStr: s.timeStr,
      });
    }
    for (const d of Object.keys(byDifficulty)) {
      byDifficulty[d].sort((a, b) => a.seconds - b.seconds);
    }
    return byDifficulty;
  });
}

/** All scores for one player, most recent puzzle first. */
export function scoresForPhone(phone) {
  return withLock(async () => {
    const db = await load();
    return db.scores.filter((s) => s.phone === phone).sort((a, b) => b.puzzle - a.puzzle);
  });
}
