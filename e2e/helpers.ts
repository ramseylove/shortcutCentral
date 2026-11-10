import fs from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { parse } from 'yaml';
import { parseKeys } from '../src/keys/notation';
import type { Pack } from '../src/packs/schema';

export const core = parse(fs.readFileSync('packs/neovim/core.yaml', 'utf8')) as Pack;

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

/** Marks earlier lessons complete so a later lesson can be opened directly. */
export async function seedCompleted(page: Page, lessonIds: string[]): Promise<void> {
  const completedLessons = Object.fromEntries(lessonIds.map((id) => [`neovim/core/${id}`, 1]));
  await page.addInitScript((value) => {
    localStorage.setItem('shortcut-central-progress', value);
  }, JSON.stringify({ state: { completedLessons }, version: 1 }));
}

/** Runs a whole lesson, answering every presentation with the canonical keys. */
export async function completeLesson(page: Page, lessonId: string): Promise<number> {
  const lesson = core.lessons.find((l) => l.id === lessonId)!;
  await page.goto(`/#/neovim/lesson/core/${lessonId}`);
  const body = page.getByTestId('lesson-body');
  const summary = page.getByTestId('lesson-summary');
  let presentations = 0;

  for (;;) {
    await expect(body.or(summary)).toBeVisible();
    if (await summary.isVisible()) break;
    const attempt = await body.getAttribute('data-attempt');
    const prompt = await page.getByTestId('prompt').innerText();
    const item = lesson.items.find((i) => i.prompt === prompt);
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
