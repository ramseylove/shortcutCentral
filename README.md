# Shortcut Central

A static, local-first web app for learning keyboard shortcuts through drills and
ordered lessons. Neovim is the first app; packs, routes and stored progress are
namespaced by app so others can be added.

## Commands

```bash
npm install
npm run dev        # dev server
npm test           # unit tests, including every goal item against the Vim engine
npm run test:e2e   # Playwright: lessons completed with real key events
npm run build      # typecheck, validate packs, build to dist/
```

## Layout

| Path | Contents |
| --- | --- |
| `packs/<app>/*.yaml` | Pack files, validated at build time. `packs/drafts/` is never loaded |
| `build/packs-plugin.ts` | Vite plugin that validates the packs and exposes them as `virtual:packs` |
| `src/packs` | Schema, registry, enabled packs, placeholder (`<leader>`) expansion |
| `src/keys` | Key event normalisation, sequence matching, Keyboard Lock |
| `src/drills` | Key-match, goal-state and query drills; the fzf query matcher |
| `src/surfaces` | Mini buffer (CodeMirror Vim mode) and the static mocks |
| `src/curriculum` | Lesson session state machine and unlock rules |
| `src/srs` | FSRS wrapper, rating derivation, review queue and session |
| `src/config` | Runs an `init.lua` in a Lua VM (wasmoon, in a Web Worker) against a stubbed `vim`, and applies the override rules |
| `src/store` | IndexedDB tables (Dexie), settings, the stored config, export and import |
| `scripts/pack-draft.ts` | Drafts a pack from a plugin's documentation with the Claude API |
| `src/screens` | Today, Curriculum, Plugins, Reference, Config, Settings, Key test, and the lesson and review runners |

## Pack format

See `packs/neovim/`. Differences from the original spec:

- A pack has an `app` field, and stored keys are `app/packId/itemId`.
- A goal item has `start` and `end` buffers with `|` marking the cursor, an
  optional `endMode` (default `normal`) and an optional `maxKeys`.
- A query item has `files` and `targets`; its `keys` are the accepted query
  strings.
- Goal and query drills have a key budget: the longest accepted answer plus a
  margin of half its length (at least 2). Any route to the end state within it
  passes.
- A pack with no `repo` is built in and always enabled; the others are toggled
  on the Plugins screen.

`npm test` runs every accepted answer of every goal item against the Vim
engine, and every query item against the matcher, so a pack cannot ship an
answer the app would reject. Each plugin pack starts with a comment naming the
documentation its mappings were checked against, and when.

## Config

The Config screen takes one `init.lua`, runs it in the browser and records the
leader keys, lazy.nvim plugin specs and key mappings. `src/config/prelude.lua`
is the stub; it is written in Lua and returns the recording as JSON.

- Packs for plugins in the config are turned on. Plugins with no pack are
  listed on the Plugins screen with the `pack:draft` command.
- A mapping whose right-hand side is in a pack item's `match` list replaces
  that item's keys. Function mappings are called once in a recording mode to
  see which plugin functions they use.
- Any other mapping with a `desc` becomes an item in the generated My config
  pack (lessons of eight). The rest are listed as warnings.
- `lazy` spec `config`, `init` and `opts` functions, `on_attach` callbacks and
  autocommand callbacks are called, since mappings are often defined there.
- With a config applied and no `mapleader` set, the leader is `\`, as in Neovim.
- The config has no file, process or network access and is stopped after two
  seconds. What it recorded up to an error or the time limit is kept.

## Drafting a pack

```bash
npm run pack:draft -- nvim-neo-tree/neo-tree.nvim
```

Needs `ANTHROPIC_API_KEY`. The script fetches the README and `doc/*.txt`,
asks Claude for a pack with a citation per item, validates it against the
schema (one retry with the errors), checks each cited quote against the
documentation, and writes `packs/drafts/<id>.yaml`. Citations that cannot be
found are marked `UNVERIFIED`. `--dry-run` prints the prompt without calling
the API. A draft is never loaded; review it, give each item a mock surface and
move it to `packs/<app>/`.

## Stored data

IndexedDB database `shortcut-central`, four tables: `cards` (FSRS state, due
date, suspended flag), `attempts`, `lessons` and `settings` (which holds the
config text and its recording). Settings →
Export writes them as one JSON document with a schema version; Import replaces
all four.
