import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { answerUntilSummary, completeLesson, packs, seedProgress, typeKeys } from './helpers';

const pack = (id: string) => packs.find((p) => p.id === id)!;

/** Flips a plugin's switch and waits for the stored setting to come back. */
async function setPlugin(page: Page, name: string, on: boolean): Promise<void> {
  const toggle = page.getByRole('switch', { name: `Enable ${name}`, exact: true });
  await toggle.click();
  await expect(toggle).toBeChecked({ checked: on });
}

test('enabling a plugin adds its lessons, and its dependants follow it', async ({ page }) => {
  await seedProgress(page, ['core/basics']);
  await page.goto('/#/neovim/curriculum');
  await expect(page.getByRole('heading', { name: 'Core Neovim' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Telescope' })).toHaveCount(0);

  await page.goto('/#/neovim/plugins');
  // fzf-native needs Telescope, so it cannot be turned on first.
  await expect(page.getByRole('switch', { name: 'Enable telescope-fzf-native' })).toBeDisabled();
  await setPlugin(page, 'Telescope', true);
  await setPlugin(page, 'telescope-fzf-native', true);

  await page.goto('/#/neovim/curriculum');
  await expect(page.getByTestId('lesson-telescope-open-pickers')).toHaveClass(/available/);
  await expect(page.getByTestId('lesson-telescope-in-picker')).toHaveClass(/locked/);
  // Locked until Telescope's first lesson is complete.
  await expect(page.getByTestId('lesson-telescope-fzf-native-search-syntax')).toHaveClass(/locked/);

  // Turning Telescope off hides both packs.
  await page.goto('/#/neovim/plugins');
  await setPlugin(page, 'Telescope', false);
  await expect(page.getByTestId('plugin-telescope-fzf-native')).toContainText('Paused until you turn on Telescope');
  await page.goto('/#/neovim/curriculum');
  await expect(page.getByRole('heading', { name: 'Core Neovim' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Telescope' })).toHaveCount(0);
});

for (const [packId, lessonId] of [
  ['telescope', 'open-pickers'],
  ['telescope', 'in-picker'],
  ['telescope', 'open-results'],
  ['telescope', 'quickfix'],
  ['gitsigns', 'hunk-actions'],
  ['telescope-fzf-native', 'search-syntax'],
]) {
  test(`${packId}/${lessonId} can be completed with real keys`, async ({ page }) => {
    const lessons = pack(packId).lessons;
    const index = lessons.findIndex((l) => l.id === lessonId);
    await seedProgress(
      page,
      [...new Set(['core/basics', 'telescope/open-pickers', ...lessons.slice(0, index).map((l) => `${packId}/${l.id}`)])],
      ['telescope', 'telescope-fzf-native', 'gitsigns'],
    );
    expect(await completeLesson(page, lessonId, packId)).toBe(lessons[index].items.length * 3);
    await expect(page.getByTestId('lesson-summary')).toContainText('100%');
  });
}

test('a query drill fails when the operators are left out', async ({ page }) => {
  await seedProgress(page, ['core/basics', 'telescope/open-pickers'], ['telescope', 'telescope-fzf-native']);
  await page.goto('/#/neovim/lesson/telescope-fzf-native/search-syntax');
  await expect(page.getByTestId('prompt')).toContainText('contain exactly "test"');
  // Fuzzy "test" also matches src/utils/dates.ts, so it never reaches the target list.
  await typeKeys(page, 'test');
  await expect(page.getByTestId('feedback')).toHaveText('');
  await typeKeys(page, 'xxx');
  await expect(page.getByTestId('feedback')).toContainText('Not quite');
});

test('disabling a pack suspends its reviews and enabling restores them', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-10T09:00:00') });
  await seedProgress(page, ['core/basics'], ['gitsigns']);
  await completeLesson(page, 'hunk-navigation', 'gitsigns');
  await page.clock.fastForward('24:00:00');
  await page.goto('/#/neovim/today');
  await expect(page.getByTestId('due-count')).toHaveText('2');

  await page.goto('/#/neovim/plugins');
  await setPlugin(page, 'gitsigns', false);
  await page.goto('/#/neovim/today');
  await expect(page.getByTestId('due-count')).toHaveText('0');

  await page.goto('/#/neovim/plugins');
  await setPlugin(page, 'gitsigns', true);
  await page.goto('/#/neovim/today');
  await expect(page.getByTestId('due-count')).toHaveText('2');
  await page.getByTestId('start-review').click();
  expect(await answerUntilSummary(page)).toBe(2);
});
