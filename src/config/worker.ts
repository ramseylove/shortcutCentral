/// <reference lib="webworker" />
import { LuaFactory } from 'wasmoon';
import wasmUrl from 'wasmoon/dist/glue.wasm?url';
import { recordConfig } from './recordConfig';
import type { Recording } from './recording';

export type WorkerMessage =
  | { type: 'ready' }
  | { type: 'done'; recording: Recording }
  | { type: 'failed'; message: string };

const post = (message: WorkerMessage) => self.postMessage(message);

self.onmessage = async (event: MessageEvent<{ source: string }>) => {
  try {
    const factory = new LuaFactory(wasmUrl);
    await factory.getLuaModule();
    post({ type: 'ready' });
    post({ type: 'done', recording: await recordConfig(event.data.source, factory) });
  } catch (error) {
    post({ type: 'failed', message: error instanceof Error ? error.message : String(error) });
  }
};
