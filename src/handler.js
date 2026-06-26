// Turns an inbound text into a reply string. Pure logic — no network here.
import { parsePipsScores, DIFFICULTY_EMOJI } from './parse.js';
import { buildBoard, WINDOWS, DIFFICULTIES } from './board.js';
import { ART_OF_WAR_QUOTES } from './quotes.js';
import { config } from './config.js';
import {
  addScore,
  setActiveName,
  getActiveName,
  getScores,
  getScoresForName,
  removeScore,
  removeAllForName,
  clearAll,
} from './store.js';

const HELP = [
  "Pips bot 🎲 — text your NYT Pips results and I'll keep the leaderboard.",
  '',
  'Commands:',
  '• BOARD — today\'s standings',
  '   add EASY / MEDIUM / HARD to filter difficulty',
  '   add WEEK / MONTH / YEAR / ALLTIME for longer windows',
  '   (e.g. BOARD HARD WEEK)',
  '• ME — your scores',
  '• NAME <your name> — log under a name (switch anytime)',
  '• INIT — this message',
].join('\n');

const TIPS_REPLY = [
  '🧠 Winning strategy: consider the Hans Niemann strategy. 👀',
  'https://www.cbssports.com/general/news/chess-sex-toy-cheating-scandal-explained-world-no-1-magnus-carlsen-hans-niemann-in-wild-sports-controversy/',
].join('\n');

// Word → canonical difficulty / window, for parsing BOARD filters.
const DIFF_WORDS = {
  easy: 'Easy', e: 'Easy',
  medium: 'Medium', med: 'Medium', m: 'Medium',
  hard: 'Hard', h: 'Hard',
};
const WINDOW_WORDS = {
  today: 'today', day: 'today',
  week: 'week', w: 'week',
  month: 'month', mo: 'month',
  year: 'year', y: 'year',
  alltime: 'alltime', all: 'alltime', 'all-time': 'alltime', lifetime: 'alltime',
};

/**
 * @param {string} phone  sender handle (E.164)
 * @param {string} text   message body
 * @returns {Promise<string|null>} reply text, or null to stay silent
 */
export async function handleMessage(phone, text) {
  const body = (text || '').trim();
  if (!body) return null;

  // 1) Score submission takes priority.
  const scores = parsePipsScores(body);
  if (scores.length > 0) return handleScores(phone, scores);

  const words = body.split(/\s+/);
  const cmd = words[0].toLowerCase();
  const rest = words.slice(1);
  const arg = rest.join(' ').trim();

  // 2) Fixed commands + easter eggs.
  switch (cmd) {
    case 'init':
    case 'help': // kept as a silent fallback — people reflexively text HELP
    case 'commands':
    case '?':
      return HELP;

    case 'me':
    case 'mine':
    case 'stats':
      return renderMyScores(phone);

    case 'name':
      if (!arg) return 'Usage: NAME <your name>  — e.g. NAME Jack';
      await setActiveName(phone, clampName(arg));
      return `You're now logging as "${clampName(arg)}". Send your Pips results! 🎲`;

    case 'tips':
      return TIPS_REPLY;

    case 'war':
      return randomWarQuote();

    case 'board':
    case 'leaderboard':
    case 'standings':
    case 'scores':
      return renderBoard(parseFilters(rest, true));

    case 'data':
      if (!isOwner(phone)) return ADMIN_ONLY;
      if (!arg) return 'Usage: DATA <name>';
      return renderData(arg);

    case 'clear':
      if (!isOwner(phone)) return ADMIN_ONLY;
      if (!arg) return 'Usage: CLEAR <id> | CLEAR <name> | CLEAR ALL';
      return handleClear(arg, rest);
  }

  // 3) Bare board shortcuts: "WEEK", "EASY", "HARD ALLTIME", "TODAY"...
  const q = parseFilters(words, false);
  if (q) return renderBoard(q);

  // 4) Fallback.
  return "Didn't catch that. Send your Pips results to log them, or text INIT for commands.";
}

async function handleScores(phone, scores) {
  const name = (await getActiveName(phone)) || maskNumber(phone);
  const lines = [];
  let puzzle = null;

  for (const s of scores) {
    puzzle = s.puzzle;
    const res = await addScore({
      phone,
      name,
      puzzle: s.puzzle,
      difficulty: s.difficulty,
      seconds: s.seconds,
      timeStr: s.timeStr,
    });
    const emoji = DIFFICULTY_EMOJI[s.difficulty] || '';
    if (res.added) {
      lines.push(`Logged ${s.difficulty} ${emoji} ${s.timeStr}`);
    } else if (res.improved) {
      lines.push(`Updated ${s.difficulty} ${emoji} ${s.timeStr} (new best!)`);
    } else {
      lines.push(`Already had a faster ${s.difficulty} (${formatSecs(res.previous)}), kept it.`);
    }
  }

  const header = `Thanks ${name}! Pips #${puzzle}`;
  const board = await renderBoard({ difficulty: null, window: 'today' });
  return [header, ...lines, '', board].join('\n');
}

/**
 * Parse difficulty/window filter words.
 * @param {string[]} words
 * @param {boolean} lenient  if true (explicit BOARD cmd), ignore unknown words;
 *                           if false (bare shortcut), return null on any unknown.
 * @returns {{difficulty:string|null, window:string}|null}
 */
function parseFilters(words, lenient) {
  let difficulty = null;
  let window = null;
  let unknown = false;

  for (const w of words) {
    const lw = w.toLowerCase();
    if (DIFF_WORDS[lw]) difficulty = DIFF_WORDS[lw];
    else if (WINDOW_WORDS[lw]) window = WINDOW_WORDS[lw];
    else unknown = true;
  }

  if (!lenient) {
    if (words.length === 0 || unknown) return null;
  }
  return { difficulty, window: window || 'today' };
}

async function renderBoard({ difficulty, window }) {
  const scores = await getScores();
  const board = buildBoard(scores, { difficulty, window, now: new Date() });
  const win = WINDOWS[window] || WINDOWS.today;

  const title = `🏆 Pips Board — ${difficulty ? `${difficulty} — ` : ''}${win.label}`;
  const out = [title];
  const diffs = difficulty ? [difficulty] : DIFFICULTIES;
  let any = false;

  for (const d of diffs) {
    const rows = board[d];
    if (!rows || rows.length === 0) continue;
    any = true;
    out.push(`${DIFFICULTY_EMOJI[d]} ${d}`);
    rows.forEach((r, i) => out.push(`${i + 1}. ${r.name} ${r.timeStr} (#${r.puzzle})`));
  }

  if (!any) {
    return `No scores yet for ${win.label}${difficulty ? ` ${difficulty}` : ''}. Send me your Pips results!`;
  }
  return out.join('\n');
}

async function renderMyScores(phone) {
  const name = (await getActiveName(phone)) || maskNumber(phone);
  const mine = await getScoresForName(name);
  if (mine.length === 0) {
    return `I have no scores for "${name}" yet. Send me your Pips results!`;
  }

  const recentPuzzle = Math.max(...mine.map((s) => s.puzzle));
  const out = [`${name} — Pips #${recentPuzzle}`];
  for (const d of DIFFICULTIES) {
    const row = mine.find((s) => s.puzzle === recentPuzzle && s.difficulty === d);
    if (row) out.push(`${DIFFICULTY_EMOJI[d]} ${d} ${row.timeStr}`);
  }
  return out.join('\n');
}

function randomWarQuote() {
  const q = ART_OF_WAR_QUOTES[Math.floor(Math.random() * ART_OF_WAR_QUOTES.length)];
  return `"${q}"\n— Sun Tzu`;
}

// ---- Admin: DATA / CLEAR ----

const ADMIN_ONLY = "That's an admin-only command.";

function normalizePhone(p) {
  return String(p || '').replace(/\D/g, '');
}

function isOwner(phone) {
  if (!config.ownerPhone) return true; // not configured → open (set OWNER_PHONE in prod)
  return normalizePhone(phone) === normalizePhone(config.ownerPhone);
}

// Stable short id for a record, derived from its identity (no schema change).
function recordId(name, puzzle, difficulty) {
  const str = `${name}|${puzzle}|${difficulty}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36).padStart(5, '0').slice(0, 5);
}

async function renderData(name) {
  const mine = await getScoresForName(name);
  if (mine.length === 0) return `No data for "${name}".`;

  const rows = mine
    .slice()
    .sort((a, b) => b.puzzle - a.puzzle)
    .map((s) => {
      const id = recordId(s.name, s.puzzle, s.difficulty);
      const emoji = DIFFICULTY_EMOJI[s.difficulty] || '';
      return `[${id}] #${s.puzzle} ${s.difficulty} ${emoji} ${s.timeStr}`;
    });

  return [
    `Data for "${name}" (${mine.length}):`,
    ...rows,
    '',
    `CLEAR <id> to delete one, or CLEAR ${name} for all.`,
  ].join('\n');
}

async function handleClear(arg, rest) {
  const upper = arg.toUpperCase();

  if (upper === 'ALL') {
    return 'This wipes ALL scores. Reply "CLEAR ALL CONFIRM" to proceed.';
  }
  if (upper === 'ALL CONFIRM') {
    await clearAll();
    return '🧹 Cleared the entire leaderboard.';
  }

  // Single token that matches a record id → delete that one record.
  if (rest.length === 1) {
    const token = rest[0].toLowerCase();
    const scores = await getScores();
    const match = scores.find((s) => recordId(s.name, s.puzzle, s.difficulty) === token);
    if (match) {
      await removeScore({ name: match.name, puzzle: match.puzzle, difficulty: match.difficulty });
      return `🧹 Cleared [${token}] ${match.name} #${match.puzzle} ${match.difficulty} ${match.timeStr}.`;
    }
  }

  // Otherwise treat the whole arg as a name.
  const removed = await removeAllForName(arg);
  if (removed === 0) return `Nothing to clear for "${arg}" (no matching id or name).`;
  return `🧹 Cleared ${removed} record${removed === 1 ? '' : 's'} for "${arg}".`;
}

function clampName(name) {
  return name.replace(/\s+/g, ' ').slice(0, 24);
}

function maskNumber(phone) {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 4 ? `...${digits.slice(-4)}` : phone;
}

function formatSecs(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
