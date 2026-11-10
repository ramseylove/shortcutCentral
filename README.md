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
| `src/store` | IndexedDB tables (Dexie), settings, export and import |
| `src/screens` | Today, Curriculum, Plugins, Reference, Settings, Key test, and the lesson and review runners |

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

## Stored data

IndexedDB database `shortcut-central`, four tables: `cards` (FSRS state, due
date, suspended flag), `attempts`, `lessons` and `settings`. Settings →
Export writes them as one JSON document with a schema version; Import replaces
all four.
