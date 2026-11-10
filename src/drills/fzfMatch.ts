/**
 * The part of fzf's search syntax that telescope-fzf-native documents:
 * space-separated terms that must all match, where a term is fuzzy by default,
 * `'exact`, `^prefix`, `suffix$`, or any of those negated with `!`.
 * Matching is smart-case. Ranking is not reproduced: drills only look at which
 * entries remain. The `|` (or) operator is not supported.
 */
interface Term {
  kind: 'fuzzy' | 'exact' | 'prefix' | 'suffix' | 'equal';
  text: string;
  inverse: boolean;
}

export function parseQuery(query: string): Term[] {
  const terms: Term[] = [];
  for (const word of query.split(/\s+/)) {
    let text = word;
    let inverse = false;
    let kind: Term['kind'] = 'fuzzy';
    if (text.startsWith('!')) {
      // A negated term is an exact match unless it says otherwise.
      inverse = true;
      kind = 'exact';
      text = text.slice(1);
    }
    if (text.startsWith("'")) {
      kind = 'exact';
      text = text.slice(1);
    } else if (text.startsWith('^')) {
      kind = 'prefix';
      text = text.slice(1);
    }
    if (text.endsWith('$') && text.length > 1) {
      kind = kind === 'prefix' ? 'equal' : 'suffix';
      text = text.slice(0, -1);
    }
    // A bare operator with nothing after it matches everything.
    if (text) terms.push({ kind, text, inverse });
  }
  return terms;
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}

function termMatches(term: Term, entry: string): boolean {
  // Smart case: a term with an upper-case letter is case-sensitive.
  const sensitive = term.text !== term.text.toLowerCase();
  const haystack = sensitive ? entry : entry.toLowerCase();
  const needle = term.text;
  let found: boolean;
  switch (term.kind) {
    case 'fuzzy':
      found = isSubsequence(needle, haystack);
      break;
    case 'exact':
      found = haystack.includes(needle);
      break;
    case 'prefix':
      found = haystack.startsWith(needle);
      break;
    case 'suffix':
      found = haystack.endsWith(needle);
      break;
    case 'equal':
      found = haystack === needle;
      break;
  }
  return found !== term.inverse;
}

/** The entries that remain for a query, in their original order. */
export function filterFiles(files: string[], query: string): string[] {
  const terms = parseQuery(query);
  return files.filter((file) => terms.every((term) => termMatches(term, file)));
}
