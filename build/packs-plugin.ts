import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Plugin } from 'vite';
import { validatePacks } from '../src/packs/schema';

const VIRTUAL_ID = 'virtual:packs';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/** Every pack file under `packs/`, skipping `packs/drafts`, which the app never loads. */
function findPackFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'drafts') out.push(...findPackFiles(full));
    } else if (/\.ya?ml$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out.sort();
}

export function loadPacksFromDisk(packsDir: string) {
  const files = findPackFiles(packsDir);
  const raw = files.map((file) => ({
    file: path.relative(packsDir, file),
    data: parseYaml(fs.readFileSync(file, 'utf8')) as unknown,
  }));
  return { files, packs: validatePacks(raw) };
}

/**
 * Exposes the validated packs as `virtual:packs`. A pack that fails the schema
 * fails the build (and the dev server shows the error overlay).
 */
export function packsPlugin(): Plugin {
  let packsDir = path.resolve('packs');
  return {
    name: 'shortcut-central-packs',
    configResolved(config) {
      packsDir = path.resolve(config.root, 'packs');
    },
    configureServer(server) {
      server.watcher.add(packsDir);
      const reload = (file: string) => {
        if (!file.startsWith(packsDir)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reload);
      server.watcher.on('change', reload);
      server.watcher.on('unlink', reload);
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      const { packs } = loadPacksFromDisk(packsDir);
      return `export default ${JSON.stringify(packs)};`;
    },
  };
}
