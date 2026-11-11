/// <reference types="vite/client" />

declare module 'virtual:packs' {
  import type { Pack } from './packs/schema';
  const packs: Pack[];
  export default packs;
}

declare module '*.lua?raw' {
  const text: string;
  export default text;
}
