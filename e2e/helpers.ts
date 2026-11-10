import fs from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { parse } from 'yaml';
import { parseKeys } from '../src/keys/notation';
import type { Pack } from '../src/packs/schema';

const loadPack = (id: string) => parse(fs.readFileSync(`packs/neovim/${id}.yaml`, 'utf8')) as Pack;
export const core = loadPack('core');
export const packs = [core, loadPack('telescope'), loadPack('telescope-fzf-native'), loadPack('gitsigns')];

const NAMED: Record<string, string> = {
  Esc: 'Escape',
  CR: 'Enter',
  Space: 'Space',
  Tab: 'Tab',
  BS: 'Backspace',
  lt: '<',
};

/** Presses one key token (Neovim notation) on the real keyboard. */
export async function pressToken(page: Page, token: string): Promise<void> {
  if ([...token].length === 1) {
    await page.keyboard.press(token);
    return;
  }
  const parts = token.slice(1, -1).split('-');
  const key = parts.pop()!;
  const mods = parts.map((m) => ({ C: 'Control', M: 'Alt', S: 'Shift', D: 'Meta' })[m]!);
  await page.keyboard.press([...mods, NAMED[key] ?? key].join('+'));
}

export async function typeKeys(page: Page, keys: string): Promise<void> {
  // The packs use the default leader, <Space>.
  for (const token of parseKeys(keys.replace('<leader>', '<Space>'))) await pressToken(page, token);
}

/**
 * Seeds progress by importing an export file through the Settings screen.
 * `lessons` are `pack/lesson` ids to mark complete; `enabled` are plugin packs to turn on.
 */
export async function seedProgress(page: Page, lessons: string[], enabled: string[] = []): Promise<void> {
  const file = {
    schemaVersion: 1,
    exportedAt: 1,
    cards: [],
    attempts: [],
    lessons: lessons.map((id) => ({ key: `neovim/${id}`, status: 'completed', completedAt: 1 })),
    settings: [{ name: 'neovim/enabledPacks', value: enabled }],
  };
  await page.goto('/#/settings');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByTestId('import-file').setInputFiles({
    name: 'seed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  });
  await expect(page.getByTestId('settings-message')).toContainText('Imported');
}

const allItems = packs.flatMap((pack) => pack.lessons.flatMap((lesson) => lesson.items));

/**
 * Answers every presentation of the running lesson or review with the item's
 * canonical keys, until the summary appears. Returns the number answered.
 */
export async function answerUntilSummary(page: Page): Promise<number> {
  const body = page.getByTestId('lesson-body');
  const summary = page.getByTestId('lesson-summary');
  let presentations = 0;

  for (;;) {
    await expect(body.or(summary)).toBeVisible();
    if (await summary.isVisible()) break;
    const attempt = await body.getAttribute('data-attempt');
    const prompt = await page.getByTestId('prompt').innerText();
    const item = allItems.find((i) => i.prompt === prompt);
    if (!item) throw new Error(`no item with prompt "${prompt}"`);
    await typeKeys(page, item.keys[0]);
    await expect(page.getByTestId('feedback')).toHaveText('Correct');
    presentations++;
    // Wait for the next presentation, or for the summary.
    await expect
      .poll(async () => (await summary.isVisible()) || (await body.getAttribute('data-attempt')) !== attempt)
      .toBe(true);
  }
  return presentations;
}

export async function completeLesson(page: Page, lessonId: string, packId = 'core'): Promise<number> {
  await page.goto(`/#/neovim/lesson/${packId}/${lessonId}`);
  return answerUntilSummary(page);
}
