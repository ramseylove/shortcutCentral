import { getApp } from '../apps';
import { formatKeys, parseKeys } from '../keys/notation';
import { basePacksForApp, cardKey } from '../packs/registry';
import { MY_CONFIG_PACK_ID, type KeysItem, type Lesson, type Pack } from '../packs/schema';
import type { ActiveConfig } from './active';
import type { RecordedMapping, Recording } from './recording';

/** Neovim's leader when a config does not set one. */
const NEOVIM_DEFAULT_LEADER = '\\';
const MY_LESSON_SIZE = 8;

const MODE_NAMES: Record<string, string> = {
  n: 'normal',
  i: 'insert',
  v: 'visual',
  x: 'visual',
  s: 'select',
  o: 'operator-pending',
  c: 'command-line',
  t: 'terminal',
};

export interface ConfigOverride {
  cardKey: string;
  packName: string;
  prompt: string;
  /** Keys in the pack file. */
  from: string[];
  /** Keys from the config. */
  to: string[];
}

export interface ConfigPlugin {
  repo: string;
  /** The pack for this plugin, if one exists. */
  packId?: string;
  packName?: string;
}

export interface ConfigWarning {
  message: string;
  line?: number;
}

/** Everything the app takes from a recorded config. */
export interface ResolvedConfig {
  active: ActiveConfig;
  leader: { keys: string; fromConfig: boolean };
  plugins: ConfigPlugin[];
  overrides: ConfigOverride[];
  /** Number of mappings in the generated My config pack. */
  ownMappings: number;
  warnings: ConfigWarning[];
  error?: Recording['error'];
}

/** A leader value (the literal characters) in key notation. */
function leaderKeys(value: string): string {
  return formatKeys([...value].flatMap((ch) => parseKeys(ch)));
}

/**
 * A mapping's left-hand side in canonical notation, or the reason it cannot be
 * drilled.
 */
export function normaliseLhs(lhs: string): { keys: string } | { problem: string } {
  for (const [group, inner] of lhs.matchAll(/<([^<>\s]+)>/g)) {
    if (parseKeys(group).length !== 1) return { problem: `uses ${group}, which is not a key that can be typed here` };
    if (/^(?:[CSMA]-)*D-/i.test(inner)) return { problem: `uses the Command key (${group}), which the browser keeps for itself` };
  }
  const tokens = parseKeys(lhs);
  if (tokens.length === 0) return { problem: 'has no keys' };
  return { keys: formatKeys(tokens) };
}

/** The forms of a mapping's right-hand side that a pack's `match` list may name. */
export function mappingRefs(mapping: RecordedMapping): string[] {
  if (mapping.refs) return mapping.refs;
  const rhs = mapping.rhs ?? '';
  const refs: string[] = [];
  const command = rhs
    .replace(/^(?:<cmd>|:)(?:<c-u>)?/i, '')
    .replace(/<cr>$/i, '')
    .trim()
    .replace(/\s+/g, ' ');
  // `lua require('telescope.builtin').find_files()` names a function.
  const lua = /require\s*\(?\s*['"]([\w./-]+)['"]\s*\)?((?:\.\w+)+)\s*\(\s*(['"][^'"]*['"])?/.exec(command);
  if (lua) {
    const path = lua[1].replace(/\//g, '.') + lua[2];
    if (lua[3]) refs.push(`${path}('${lua[3].slice(1, -1)}')`);
    refs.push(path);
  }
  if (command) refs.push(command);
  return refs;
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return slug || 'mapping';
}

function describe(mapping: RecordedMapping): string {
  return `The mapping for ${mapping.lhs}`;
}

/** Applies the override rules to a recording. Pure: the same recording and packs give the same result. */
export function resolveConfig(appId: string, recording: Recording, packs: Pack[] = basePacksForApp(appId)): ResolvedConfig {
  const warnings: ConfigWarning[] = recording.warnings.map((w) => ({ ...w }));

  // Pack items by each entry of their `match` list.
  const matchIndex = new Map<string, { pack: Pack; item: KeysItem }[]>();
  for (const pack of packs) {
    for (const lesson of pack.lessons) {
      for (const item of lesson.items) {
        if (item.type !== 'keys') continue;
        for (const entry of item.match ?? []) {
          const list = matchIndex.get(entry) ?? [];
          list.push({ pack, item });
          matchIndex.set(entry, list);
        }
      }
    }
  }

  const overrideKeys = new Map<string, string[]>();
  const overrides = new Map<string, ConfigOverride>();
  const ownItems: KeysItem[] = [];
  const ownIds = new Set<string>();
  const ownSeen = new Set<string>();

  for (const mapping of recording.mappings) {
    const lhs = normaliseLhs(mapping.lhs);
    const refs = mappingRefs(mapping);
    // A reference with its argument (`nav_hunk('next')`) is more specific than one without.
    const specific = refs.filter((ref) => ref.includes('(')).find((ref) => matchIndex.has(ref));
    const matched = matchIndex.get(specific ?? refs.find((ref) => matchIndex.has(ref)) ?? '');

    if ('problem' in lhs) {
      // Mappings to <Nop>, <Plug> targets and the like are only worth reporting when they would have been used.
      if (matched || mapping.desc) warnings.push({ message: `${describe(mapping)} ${lhs.problem}, so it was skipped.`, line: mapping.line });
      continue;
    }

    // Rule 1: the right-hand side is an action some pack already teaches.
    if (matched) {
      for (const { pack, item } of matched) {
        const key = cardKey(pack, item);
        const keys = overrideKeys.get(key) ?? [];
        if (!keys.includes(lhs.keys)) keys.push(lhs.keys);
        overrideKeys.set(key, keys);
        overrides.set(key, { cardKey: key, packName: pack.name, prompt: item.prompt, from: item.keys, to: keys });
      }
      continue;
    }

    // Rule 2: a described mapping becomes an item in the My config pack.
    if (mapping.desc) {
      const otherModes = mapping.modes.includes('n') ? [] : [...new Set(mapping.modes.map((m) => MODE_NAMES[m] ?? m))];
      const prompt = otherModes.length > 0 ? `${mapping.desc} (${otherModes.join(' or ')} mode)` : mapping.desc;
      const signature = `${lhs.keys}\n${prompt}`;
      if (ownSeen.has(signature)) continue;
      ownSeen.add(signature);
      const base = slugify(mapping.desc);
      let id = base;
      for (let n = 2; ownIds.has(id); n++) id = `${base}-${n}`;
      ownIds.add(id);
      ownItems.push({ id, type: 'keys', action: `config.${id}`, prompt, keys: [lhs.keys], source: 'config' });
      continue;
    }

    // Rule 3: nothing to make a prompt from.
    warnings.push({
      message:
        mapping.rhs === undefined
          ? `${describe(mapping)} runs a Lua function and has no desc, so there is nothing to make a prompt from. Add a desc to drill it.`
          : `${describe(mapping)} has no desc, so there is nothing to make a prompt from. Add a desc to drill it.`,
      line: mapping.line,
    });
  }

  const lessons: Lesson[] = [];
  for (let i = 0; i < ownItems.length; i += MY_LESSON_SIZE) {
    const n = lessons.length + 1;
    lessons.push({
      id: `mappings-${n}`,
      title: ownItems.length > MY_LESSON_SIZE ? `My mappings, part ${n}` : 'My mappings',
      items: ownItems.slice(i, i + MY_LESSON_SIZE),
    });
  }
  const myPack: Pack | null =
    lessons.length > 0
      ? { id: MY_CONFIG_PACK_ID, app: appId, name: 'My config', version: 1, requires: [], lessons }
      : null;

  const leader = recording.leader ?? NEOVIM_DEFAULT_LEADER;
  const placeholders: Record<string, string> = { ...getApp(appId)?.placeholders, leader: leaderKeys(leader) };
  if (recording.localleader !== undefined) placeholders.localleader = leaderKeys(recording.localleader);
  else placeholders.localleader = NEOVIM_DEFAULT_LEADER;

  const plugins = recording.plugins.map((repo): ConfigPlugin => {
    const pack = packs.find((p) => p.repo?.toLowerCase() === repo.toLowerCase());
    return pack ? { repo, packId: pack.id, packName: pack.name } : { repo };
  });

  return {
    active: { placeholders, overrides: overrideKeys, myPack },
    leader: { keys: placeholders.leader, fromConfig: recording.leader !== undefined },
    plugins,
    overrides: [...overrides.values()],
    ownMappings: ownItems.length,
    warnings,
    error: recording.error,
  };
}
