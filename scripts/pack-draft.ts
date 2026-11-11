/**
 * Drafts a pack for a plugin from its documentation, using the Claude API.
 *
 *   npm run pack:draft -- <owner/repo> [--app neovim] [--dry-run]
 *
 * The draft is written to packs/drafts/<id>.yaml, which the app never loads.
 * Check every mapping against the plugin, give each item a mock surface, then
 * move the file into packs/<app>/.
 */
import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { MOCK_NAMES, packSchema, type Pack } from '../src/packs/schema.ts';

const MODEL = 'claude-opus-5-5';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXAMPLE_PACK = 'packs/neovim/gitsigns.yaml';

interface Doc {
  path: string;
  lines: string[];
}

interface Citation {
  doc: string;
  line: number;
  quote: string;
}

function fail(message: string): never {
  console.error(`pack:draft: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Fetching documentation

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string | null> {
  const response = await fetch(url, { headers: { 'User-Agent': 'pack-draft', ...headers } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

/** The plugin's README and `doc/*.txt` help files. */
async function fetchDocs(repo: string): Promise<Doc[]> {
  const auth: Record<string, string> = process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  const docs: Doc[] = [];
  const add = (file: string, text: string | null) => {
    if (text) docs.push({ path: file, lines: text.split(/\r?\n/) });
  };
  const raw = (file: string) => fetchText(`https://raw.githubusercontent.com/${repo}/HEAD/${file}`);

  let helpFiles: string[] | null = null;
  try {
    const listing = await fetchText(`https://api.github.com/repos/${repo}/contents/doc`, {
      Accept: 'application/vnd.github+json',
      ...auth,
    });
    if (listing) {
      helpFiles = (JSON.parse(listing) as { name: string; type: string }[])
        .filter((entry) => entry.type === 'file' && entry.name.endsWith('.txt'))
        .map((entry) => `doc/${entry.name}`);
    } else {
      helpFiles = [];
    }
  } catch (error) {
    console.warn(`Could not list doc/ through the GitHub API (${(error as Error).message}); trying the usual file names.`);
  }
  if (helpFiles === null) {
    // Help files are conventionally named after the plugin.
    const name = repo.split('/')[1];
    const stems = new Set([name, name.replace(/\.(nvim|vim)$/, ''), name.replace(/^(nvim|vim)-/, '').replace(/\.(nvim|vim)$/, '')]);
    helpFiles = [...stems].map((stem) => `doc/${stem}.txt`);
  }

  add('README.md', (await raw('README.md')) ?? (await raw('readme.md')));
  for (const file of helpFiles) add(file, await raw(file));
  return docs;
}

function numbered(doc: Doc): string {
  return doc.lines.map((line, i) => `${i + 1}: ${line}`).join('\n');
}

// ---------------------------------------------------------------------------
// Prompt

function buildSystemPrompt(): string {
  const schema = fs.readFileSync(path.join(ROOT, 'src/packs/schema.ts'), 'utf8');
  const example = fs.readFileSync(path.join(ROOT, EXAMPLE_PACK), 'utf8');
  return `You draft "packs" for Shortcut Central, a web app that teaches keyboard shortcuts through timed drills. A pack is a data file listing the shortcuts of one plugin, grouped into short lessons. A human reviews every draft against the real plugin before it ships, so the draft's job is to be accurate and easy to check: each shortcut must come from the documentation you are given, with a citation the reviewer can follow.

<pack_schema>
The pack is validated with this Zod schema. Your output must pass it.

${schema}
</pack_schema>

<example_pack path="${EXAMPLE_PACK}">
A finished, reviewed pack, shown for its style: lesson size, prompt wording, ids and match lists.

${example}
</example_pack>

What to produce:
- Only items of type "keys". The other item types need hand-built buffers and are added by the reviewer.
- Leave "surface" out. The reviewer assigns a mock; the mocks that exist are: ${MOCK_NAMES.join(', ')}.
- Lessons of roughly 4 to 10 items, ordered so that the most-used shortcuts come first and each lesson has one theme. Cover the shortcuts a regular user of the plugin relies on; leave out rarely used ones rather than padding the pack.
- "prompt" says what the shortcut does, as an instruction to carry out ("Stage the hunk under the cursor"), without naming the keys.
- "keys" uses Neovim notation (<leader>, <C-w>, <CR>, <Space>). A sequence that only works inside one of the plugin's windows is still written as the keys alone.
- "source" is "default" when the plugin defines the mapping itself, and "suggested" when the documentation only recommends it for the user's config. Suggested items need a "match" list: the command string and the Lua function reference a user's config would map, in the forms the example uses, so the app can recognise the user's own keys for that action.
- The pack's "app" is given to you. Its "id" is a short slug for the plugin, "version" is 1, and "repo" is the repository.

Citations: alongside the schema's fields, give every item a "cite" object: {"doc": the file path, "line": the line number where the mapping is documented, "quote": that line's text copied exactly, or the relevant part of it}. Documentation lines are prefixed with their line number. If the documentation does not state a mapping, leave the shortcut out; a reviewer can add it, but cannot easily catch an invented one.

Reply with the pack as one JSON object and nothing else.`;
}

function buildUserPrompt(repo: string, app: string, docs: Doc[]): string {
  const files = docs.map((doc) => `<doc path="${doc.path}">\n${numbered(doc)}\n</doc>`).join('\n\n');
  return `${files}\n\nDraft a pack for the plugin ${repo}. The pack's app is "${app}".`;
}

// ---------------------------------------------------------------------------
// Calling the model

async function ask(system: string, messages: Anthropic.Beta.BetaMessageParam[]): Promise<string> {
  // Credentials come from the environment: ANTHROPIC_API_KEY, or an `ant auth login` profile.
  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    // If the model declines the request, the API retries it on a fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    messages,
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') fail(`the model declined the request (${message.stop_details?.category ?? 'no category'}).`);
  if (message.stop_reason === 'max_tokens') fail('the reply was cut off at the output limit; the plugin may be too large for one draft.');
  return message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
}

// ---------------------------------------------------------------------------
// Validating and writing the draft

interface Draft {
  pack: Pack;
  citations: Map<string, Citation>;
}

/** Parses a reply into a valid pack, or returns the problems to send back. */
export function parseDraft(reply: string): Draft | { problems: string[] } {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  let json: unknown;
  try {
    json = JSON.parse(reply.slice(start, end + 1));
  } catch (error) {
    return { problems: [`The reply is not valid JSON: ${(error as Error).message}`] };
  }

  // Citations are not part of the pack schema; they are lifted out first.
  const citations = new Map<string, Citation>();
  const lessons = (json as { lessons?: unknown }).lessons;
  if (Array.isArray(lessons)) {
    for (const lesson of lessons) {
      for (const item of Array.isArray(lesson?.items) ? lesson.items : []) {
        const cite = item?.cite;
        if (typeof item?.id === 'string' && cite && typeof cite.doc === 'string' && typeof cite.line === 'number') {
          citations.set(item.id, { doc: cite.doc, line: cite.line, quote: String(cite.quote ?? '') });
        }
        if (item && typeof item === 'object') delete item.cite;
      }
    }
  }

  const result = packSchema.safeParse(json);
  if (!result.success) {
    return { problems: result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`) };
  }
  const problems: string[] = [];
  for (const lesson of result.data.lessons) {
    for (const item of lesson.items) {
      if (item.type !== 'keys') problems.push(`item "${item.id}": only items of type "keys" can be drafted`);
      if (!citations.has(item.id)) problems.push(`item "${item.id}": missing "cite" with doc, line and quote`);
      if (item.source === 'suggested' && !item.match?.length) problems.push(`item "${item.id}": a suggested item needs a "match" list`);
    }
  }
  return problems.length > 0 ? { problems } : { pack: result.data, citations };
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Whether the quoted text really is at (or within two lines of) the cited line. */
export function citationHolds(cite: Citation, docs: Doc[]): boolean {
  const doc = docs.find((d) => d.path === cite.doc);
  const quote = squash(cite.quote);
  if (!doc || quote === '') return false;
  const nearby = doc.lines.slice(Math.max(0, cite.line - 3), cite.line + 2).join(' ');
  return squash(nearby).includes(quote);
}

/** The pack as YAML, with a comment above each item citing its documentation. */
export function renderDraft(draft: Draft, repo: string, docs: Doc[], today: string): { yaml: string; unverified: number } {
  let unverified = 0;
  let yaml = stringify(draft.pack, { lineWidth: 0 });
  for (const lesson of draft.pack.lessons) {
    for (const item of lesson.items) {
      const cite = draft.citations.get(item.id)!;
      const holds = citationHolds(cite, docs);
      if (!holds) unverified++;
      const comment =
        `# ${cite.doc}:${cite.line}: ${squash(cite.quote)}` +
        (holds ? '' : '\n# UNVERIFIED: this text was not found at that line. Check the mapping by hand.');
      // Each item starts with its id, which is unique within the pack.
      const anchor = new RegExp(`^(\\s*)- id: ${item.id}$`, 'm');
      yaml = yaml.replace(anchor, (line, indent: string) => `${comment.replace(/^/gm, indent)}\n${line}`);
    }
  }
  const header = [
    `# DRAFT generated by \`npm run pack:draft -- ${repo}\` on ${today} from:`,
    ...docs.map((doc) => `#   ${doc.path} (${doc.lines.length} lines)`),
    '# Not loaded by the app. Before moving it to packs/<app>/:',
    '#   1. Check each mapping against the plugin; the comment above an item cites its source.',
    `#   2. Give each item a surface (mocks: ${MOCK_NAMES.join(', ')}).`,
    '#   3. Replace this header with a line naming the documentation checked, and when.',
    '',
  ].join('\n');
  return { yaml: `${header}\n${yaml}`, unverified };
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const appFlag = args.indexOf('--app');
  const app = appFlag === -1 ? 'neovim' : args[appFlag + 1];
  const repo = args.find((arg, i) => !arg.startsWith('--') && (appFlag === -1 || i !== appFlag + 1));
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) fail('usage: npm run pack:draft -- <owner/repo> [--app neovim] [--dry-run]');

  console.log(`Fetching documentation for ${repo}…`);
  const docs = await fetchDocs(repo);
  if (docs.length === 0) fail(`no README or doc/*.txt found in ${repo}.`);
  for (const doc of docs) console.log(`  ${doc.path}: ${doc.lines.length} lines`);

  const system = buildSystemPrompt();
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: buildUserPrompt(repo, app, docs) }];
  if (dryRun) {
    console.log(`\n--- system prompt ---\n${system}\n\n--- user message: ${buildUserPrompt(repo, app, docs).length} characters ---`);
    return;
  }

  let draft: Draft | undefined;
  for (let attempt = 1; attempt <= 2 && !draft; attempt++) {
    console.log(attempt === 1 ? `Asking ${MODEL} for a draft…` : 'Asking again with the validation errors…');
    const reply = await ask(system, messages);
    const parsed = parseDraft(reply);
    if ('pack' in parsed) {
      draft = parsed;
    } else if (attempt === 1) {
      console.warn(`The draft did not validate:\n  ${parsed.problems.join('\n  ')}`);
      messages.push(
        { role: 'assistant', content: reply },
        { role: 'user', content: `That pack did not validate. Fix these problems and reply with the whole corrected JSON object:\n\n${parsed.problems.join('\n')}` },
      );
    } else {
      fail(`the second draft did not validate either:\n  ${parsed.problems.join('\n  ')}`);
    }
  }

  const { yaml, unverified } = renderDraft(draft!, repo, docs, new Date().toISOString().slice(0, 10));
  const file = path.join(ROOT, 'packs/drafts', `${draft!.pack.id}.yaml`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, yaml);
  const items = draft!.pack.lessons.reduce((sum, lesson) => sum + lesson.items.length, 0);
  console.log(`Wrote ${path.relative(ROOT, file)}: ${draft!.pack.lessons.length} lessons, ${items} items.`);
  if (unverified > 0) console.log(`${unverified} citation(s) could not be found in the documentation and are marked UNVERIFIED.`);
}

// Only run when called as a script, so the tests can import the helpers.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    await main();
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) fail('the API key was rejected. Set ANTHROPIC_API_KEY, or run `ant auth login`.');
    if (error instanceof Anthropic.RateLimitError) fail('rate limited by the API; try again shortly.');
    if (error instanceof Anthropic.APIError) fail(`API error ${error.status}: ${error.message}`);
    fail(error instanceof Error ? error.message : String(error));
  }
}
