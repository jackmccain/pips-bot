// Pure leaderboard computation over raw score records. No I/O here.

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

// Time windows, filtered on each score's submission timestamp (`at`).
export const WINDOWS = {
  today: { label: 'Today' },
  week: { label: 'Past 7 days' },
  month: { label: 'Past 30 days' },
  year: { label: 'Past year' },
  alltime: { label: 'All-time' },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function windowStartMs(window, now) {
  const t = now.getTime();
  switch (window) {
    case 'today': {
      const d = new Date(now);
      d.setUTCHours(0, 0, 0, 0);
      return d.getTime();
    }
    case 'week':
      return t - 7 * DAY_MS;
    case 'month':
      return t - 30 * DAY_MS;
    case 'year':
      return t - 365 * DAY_MS;
    case 'alltime':
    default:
      return 0;
  }
}

function inWindow(score, window, now) {
  if (window === 'alltime') return true;
  const at = Date.parse(score.at) || 0;
  return at >= windowStartMs(window, now);
}

/**
 * Build standings. Within a window+difficulty, each player is ranked by their
 * single fastest time (the puzzle it came from is included for context).
 * @returns {{[difficulty:string]: Array<{name, seconds, timeStr, puzzle}>}}
 */
export function buildBoard(scores, { difficulty = null, window = 'today', now = new Date(), limit = 10 } = {}) {
  const diffs = difficulty ? [difficulty] : DIFFICULTIES;
  const result = {};
  for (const d of diffs) {
    const best = new Map(); // name -> best entry
    for (const s of scores) {
      if (s.difficulty !== d) continue;
      if (!inWindow(s, window, now)) continue;
      const cur = best.get(s.name);
      if (!cur || s.seconds < cur.seconds) {
        best.set(s.name, { name: s.name, seconds: s.seconds, timeStr: s.timeStr, puzzle: s.puzzle });
      }
    }
    result[d] = [...best.values()].sort((a, b) => a.seconds - b.seconds).slice(0, limit);
  }
  return result;
}
