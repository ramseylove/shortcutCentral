import { CONFIG_TIME_LIMIT_MS, type Recording } from './recording';
import type { WorkerMessage } from './worker';

const LOAD_LIMIT_MS = 20_000;
/** The VM stops itself at the limit; the worker is killed if that does not work. */
const KILL_MARGIN_MS = 1500;

/**
 * Runs a config in a Lua VM inside a Web Worker and returns what it recorded.
 * The VM is downloaded on first use. A config that cannot be stopped from
 * inside (the worker is terminated instead) rejects.
 */
export function runConfig(source: string): Promise<Recording> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    let timer = window.setTimeout(() => finish(() => reject(new Error('The Lua runtime could not be loaded.'))), LOAD_LIMIT_MS);
    const finish = (settle: () => void) => {
      window.clearTimeout(timer);
      worker.terminate();
      settle();
    };
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === 'ready') {
        window.clearTimeout(timer);
        timer = window.setTimeout(
          () => finish(() => reject(new Error(`The config ran for more than ${CONFIG_TIME_LIMIT_MS / 1000} seconds and was stopped.`))),
          // Two passes can each use the limit: the config, then what it scheduled.
          CONFIG_TIME_LIMIT_MS * 2 + KILL_MARGIN_MS,
        );
      } else if (message.type === 'done') {
        finish(() => resolve(message.recording));
      } else {
        finish(() => reject(new Error(message.message)));
      }
    };
    worker.onerror = (event) => finish(() => reject(new Error(event.message || 'The Lua runtime failed to start.')));
    worker.postMessage({ source });
  });
}
