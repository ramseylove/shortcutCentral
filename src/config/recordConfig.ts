import type { LuaFactory } from 'wasmoon';
import prelude from './prelude.lua?raw';
import { CONFIG_TIME_LIMIT_MS, type Recording } from './recording';

interface RawRecording extends Omit<Recording, 'error'> {
  error?: string;
}

function parseError(raw: string): Recording['error'] {
  const located = /^init\.lua:(\d+): ([\s\S]*)$/.exec(raw);
  if (located) return { message: located[2], line: Number(located[1]) };
  return { message: raw };
}

/**
 * Runs a config in a fresh Lua VM and returns what it did. The VM has no file,
 * process or network access. A config that runs past the time limit is stopped with an error
 * and keeps what it had recorded.
 */
export async function recordConfig(source: string, factory: LuaFactory): Promise<Recording> {
  const lua = await factory.createEngine();
  try {
    lua.global.set('__config_source', source);
    lua.global.set('__config_time_limit', CONFIG_TIME_LIMIT_MS / 1000);
    const json: string = await lua.doString(prelude);
    const raw = JSON.parse(json) as RawRecording;
    return { ...raw, error: raw.error === undefined ? undefined : parseError(raw.error) };
  } finally {
    lua.global.close();
  }
}
