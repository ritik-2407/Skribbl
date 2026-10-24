// Word-matching logic (an interview favourite: "case, trim, partial").
//
// Rules:
//   - case-insensitive            "DOG"      == "dog"
//   - whitespace trimmed/collapsed "  ice   cream " == "ice cream"
//   - accents ignored              "café"     == "cafe"
//   - hyphens/punctuation ignored  "ice-cream" == "ice cream"
//   - spaces ignored when comparing "icecream" == "ice cream"
//   - PARTIAL matches are NOT correct ("do" or "its a dog" != "dog"),
//     otherwise players could spam substrings to win.
//   - "close" = exactly 1 typo away (only for words >= 4 letters). The guesser is
//     told privately, but it earns no points.

export function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

// Returns 'correct' | 'close' | 'wrong'
export function matchGuess(guess, word) {
  const g = normalize(guess).replace(/ /g, '');
  const w = normalize(word).replace(/ /g, '');
  if (!g) return 'wrong';
  if (g === w) return 'correct';
  if (w.length >= 4 && levenshtein(g, w) === 1) return 'close';
  return 'wrong';
}
