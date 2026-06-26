// Offline self-test for the parser + handler. No network. Run: npm run test:parse
import { parsePipsScores } from '../src/parse.js';

const samples = [
  {
    name: 'single block',
    text: 'Pips #3 Easy 🟢\n0:32',
    expect: [{ puzzle: 3, difficulty: 'Easy', seconds: 32 }],
  },
  {
    name: 'two blocks with cookie',
    text: 'Pips #3 Easy 🟢\n0:32\nPips #3 Medium 🟡\n0:40 🍪',
    expect: [
      { puzzle: 3, difficulty: 'Easy', seconds: 32 },
      { puzzle: 3, difficulty: 'Medium', seconds: 40 },
    ],
  },
  {
    name: 'hard with minutes',
    text: 'Pips #2 Hard 🔴\n4:23',
    expect: [{ puzzle: 2, difficulty: 'Hard', seconds: 263 }],
  },
  {
    name: 'surrounded by chatter',
    text: 'lol check it\nPips #10 Medium 🟡\n1:05\nnot bad right',
    expect: [{ puzzle: 10, difficulty: 'Medium', seconds: 65 }],
  },
  { name: 'no scores', text: 'BOARD', expect: [] },
];

let pass = 0;
let fail = 0;

for (const s of samples) {
  const got = parsePipsScores(s.text);
  const slim = got.map((g) => ({ puzzle: g.puzzle, difficulty: g.difficulty, seconds: g.seconds }));
  const ok = JSON.stringify(slim) === JSON.stringify(s.expect);
  console.log(`${ok ? '✅' : '❌'} ${s.name}`);
  if (!ok) {
    console.log('   expected:', JSON.stringify(s.expect));
    console.log('   got:     ', JSON.stringify(slim));
    fail++;
  } else {
    pass++;
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
