// Turns an inbound text into a reply string. Pure logic — no network here.
import { parsePipsScores, DIFFICULTY_EMOJI } from './parse.js';
import {
  addScore,
  setName,
  getName,
  leaderboard,
  latestPuzzle,
  scoresForPhone,
} from './store.js';

const DIFFICULTY_ORDER = ['Easy', 'Medium', 'Hard'];

const HELP = [
  'Pips bot 🎲 — text me your NYT Pips results and I\'ll keep the leaderboard.',
  '',
  'Commands:',
  '• BOARD — today\'s standings',
  '• ME — your scores',
  '• NAME <your name> — set how you show up',
  '• HELP — this message',
].join('\n');

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

  // 2) Otherwise, a command. Match on the first word.
  const [word, ...rest] = body.split(/\s+/);
  const cmd = word.toLowerCase();
  const arg = rest.join(' ').trim();

  switch (cmd) {
    case 'help':
    case 'commands':
    case '?':
      return HELP;

    case 'board':
    case 'leaderboard':
    case 'standings':
    case 'today':
    case 'scores':
      return renderLeaderboard();

    case 'me':
    case 'mine':
    case 'stats':
      return renderMyScores(phone);

    case 'name':
      if (!arg) return 'Usage: NAME <your name>  — e.g. NAME Jack';
      await setName(phone, clampName(arg));
      return `Got it — you'll show up as "${clampName(arg)}".`;

    default:
      return `Didn't catch that. Send your Pips results to log them, or text HELP for commands.`;
  }
}

async function handleScores(phone, scores) {
  const name = await getName(phone);
  const lines = [];
  let puzzle = null;

  for (const s of scores) {
    puzzle = s.puzzle;
    const res = await addScore({
      phone,
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
  const board = await renderLeaderboard(puzzle);
  return [header, ...lines, '', board].join('\n');
}

async function renderLeaderboard(puzzle) {
  const p = puzzle ?? (await latestPuzzle());
  if (p == null) return 'No scores yet. Be the first — text me your Pips results!';

  const board = await leaderboard(p);
  const out = [`🏆 Pips #${p} standings`];
  let any = false;

  for (const d of DIFFICULTY_ORDER) {
    const rows = board[d];
    if (!rows || rows.length === 0) continue;
    any = true;
    out.push(`${DIFFICULTY_EMOJI[d]} ${d}`);
    rows.forEach((r, i) => out.push(`${i + 1}. ${r.name} ${r.timeStr}`));
  }

  if (!any) return `No scores yet for Pips #${p}.`;
  return out.join('\n');
}

async function renderMyScores(phone) {
  const mine = await scoresForPhone(phone);
  if (mine.length === 0) return 'I have no scores for you yet. Send me your Pips results!';

  const name = await getName(phone);
  const recentPuzzle = mine[0].puzzle;
  const out = [`${name} — Pips #${recentPuzzle}`];
  for (const d of DIFFICULTY_ORDER) {
    const row = mine.find((s) => s.puzzle === recentPuzzle && s.difficulty === d);
    if (row) out.push(`${DIFFICULTY_EMOJI[d]} ${d} ${row.timeStr}`);
  }
  return out.join('\n');
}

function clampName(name) {
  return name.replace(/\s+/g, ' ').slice(0, 24);
}

function formatSecs(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
