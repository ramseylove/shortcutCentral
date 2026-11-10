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
| `src/packs` | Schema, registry, placeholder (`<leader>`) expansion |
| `src/keys` | Key event normalisation, sequence matching, Keyboard Lock |
| `src/drills` | Key-match and goal-state drills |
| `src/surfaces` | Mini buffer (CodeMirror Vim mode) and static mocks |
| `src/curriculum` | Lesson session state machine and unlock rules |
| `src/store` | Stored progress |
| `src/screens` | Curriculum, lesson and key-test screens |

## Pack format

See `packs/neovim/core.yaml`. Differences from the original spec:

- A pack has an `app` field, and stored keys are `app/packId/itemId`.
- A goal item has `start` and `end` buffers with `|` marking the cursor, an
  optional `endMode` (default `normal`) and an optional `maxKeys`.
- Goal drills have a key budget: the longest accepted answer plus a margin of
  half its length (at least 2). Any route to the end state within it passes.

Every accepted answer of every goal item is run against the Vim engine in
`npm test`, so a pack cannot ship a command the mini buffer handles differently.
