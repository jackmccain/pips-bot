// Parse NYT Pips share text into structured scores.
//
// A shared result looks like (one or more 2-line blocks):
//
//   Pips #3 Easy 🟢
//   0:32
//   Pips #3 Medium 🟡
//   0:40 🍪
//
// Header line:  Pips #<number> <Easy|Medium|Hard> <emoji>
// Time line:    M:SS  (optionally followed by a 🍪 we ignore)

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
export const DIFFICULTY_EMOJI = { Easy: '🟢', Medium: '🟡', Hard: '🔴' };

// Matches a header line, then the next line's M:SS time.
// [^\n]* on the header line soaks up the trailing color emoji / whitespace.
const BLOCK_RE = /Pips\s*#?\s*(\d+)\s+(Easy|Medium|Hard)[^\n]*\n\s*(\d{1,2}):(\d{2})/gi;

function titleCase(d) {
  const lower = d.toLowerCase();
  return DIFFICULTIES.find((x) => x.toLowerCase() === lower) || d;
}

/**
 * Extract every Pips score block from a message.
 * @param {string} text
 * @returns {Array<{puzzle:number, difficulty:string, minutes:number, secondsPart:number, seconds:number, timeStr:string}>}
 */
export function parsePipsScores(text) {
  if (!text) return [];
  const results = [];
  for (const m of text.matchAll(BLOCK_RE)) {
    const puzzle = Number(m[1]);
    const difficulty = titleCase(m[2]);
    const minutes = Number(m[3]);
    const secondsPart = Number(m[4]);
    if (secondsPart > 59) continue; // not a valid M:SS time
    const seconds = minutes * 60 + secondsPart;
    results.push({
      puzzle,
      difficulty,
      minutes,
      secondsPart,
      seconds,
      timeStr: `${minutes}:${String(secondsPart).padStart(2, '0')}`,
    });
  }
  return results;
}

/** Format a number of seconds back to M:SS. */
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
