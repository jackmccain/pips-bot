// Persistence for scores + the active "persona" name per phone.
//
// Identity is NAME-based, not phone-based: a phone sets its active name with
// NAME, and every score is attributed to whatever name was active when it was
// sent. Switching names does not move old scores. Several people can therefore
// share one phone and each keep their own scores.
//
// Two backends, chosen automatically:
//   • Upstash Redis (when UPSTASH_REDIS_REST_* are set) — survives restarts.
//   • Local JSON file (data/scores.json) — for local development.
//
// All functions are async. A small in-process lock serializes read-modify-write.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'scores.json');
const REDIS_KEY = 'pips-bot:db';

const useRedis = Boolean(config.redisUrl && config.redisToken);
const empty = () => ({ active: {}, scores: [] });

export function backendName() {
  return useRedis ? 'upstash-redis' : 'local-file';
}

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

function normalize(db) {
  if (!db || typeof db !== 'object') return empty();
  db.active ||= {};
  db.scores ||= [];
  return db;
}

async function load() {
  if (useRedis) {
    const raw = await redisCommand(['GET', REDIS_KEY]);
    if (!raw) return empty();
    try {
      return normalize(JSON.parse(raw));
    } catch {
      return empty();
    }
  }
  try {
    return normalize(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
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

/** Set the active persona for a phone. */
export function setActiveName(phone, name) {
  return withLock(async () => {
    const db = await load();
    db.active[phone] = name;
    await save(db);
  });
}

/** The active persona for a phone, or null if none chosen yet. */
export function getActiveName(phone) {
  return withLock(async () => {
    const db = await load();
    return db.active[phone] || null;
  });
}

/**
 * Record a score under a name. One best (fastest) time is kept per
 * name+puzzle+difficulty.
 * @returns {Promise<{added:boolean, improved:boolean, previous?:number}>}
 */
export function addScore({ phone, name, puzzle, difficulty, seconds, timeStr }) {
  return withLock(async () => {
    const db = await load();
    const existing = db.scores.find(
      (s) => s.name === name && s.puzzle === puzzle && s.difficulty === difficulty
    );

    if (!existing) {
      db.scores.push({ name, phone, puzzle, difficulty, seconds, timeStr, at: new Date().toISOString() });
      await save(db);
      return { added: true, improved: false };
    }

    if (seconds < existing.seconds) {
      const previous = existing.seconds;
      existing.seconds = seconds;
      existing.timeStr = timeStr;
      existing.phone = phone;
      existing.at = new Date().toISOString();
      await save(db);
      return { added: false, improved: true, previous };
    }

    return { added: false, improved: false, previous: existing.seconds };
  });
}

/** All score records (a shallow copy). */
export function getScores() {
  return withLock(async () => {
    const db = await load();
    return db.scores.slice();
  });
}

/** All scores logged under a given name. */
export function getScoresForName(name) {
  return withLock(async () => {
    const db = await load();
    return db.scores.filter((s) => s.name === name);
  });
}
