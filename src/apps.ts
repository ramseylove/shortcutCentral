/**
 * An app is a program whose shortcuts can be learned. Packs, stored progress and
 * routes are all namespaced by app id, so further apps can be added later
 * without touching existing data.
 */
export interface AppDefinition {
  id: string;
  name: string;
  /** Default values for placeholders used in pack key sequences, e.g. `<leader>`. */
  placeholders: Record<string, string>;
}

export const APPS: AppDefinition[] = [
  {
    id: 'neovim',
    name: 'Neovim',
    placeholders: { leader: '<Space>', localleader: '\\' },
  },
];

export const DEFAULT_APP_ID = 'neovim';

export function getApp(id: string): AppDefinition | undefined {
  return APPS.find((app) => app.id === id);
}
