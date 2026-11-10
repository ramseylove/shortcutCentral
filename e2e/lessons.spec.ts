import { expect, test } from '@playwright/test';
import { completeLesson, core, seedCompleted, typeKeys } from './helpers';

test('key test page shows captured keys in Neovim notation', async ({ page }) => {
  await page.goto('/#/key-test');
  await expect(page.getByText('Nothing pressed yet.')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+r');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+G');
  await page.keyboard.press('$');
  const rows = page.getByTestId('key-log').locator('tr td:first-child');
  await expect(rows).toHaveText(['$', 'G', '<S-Tab>', '<C-r>', '<Esc>']);
  await expect(page.getByTestId('chord-<C-r>')).toHaveClass(/seen/);
  await expect(page.getByTestId('chord-<C-w>')).not.toHaveClass(/seen/);
});

test('a key-match lesson can be completed from the pack file', async ({ page }) => {
  await page.goto('/#/neovim/curriculum');
  await expect(page.getByTestId('lesson-core-basics')).toHaveClass(/available/);
  await expect(page.getByTestId('lesson-core-motions')).toHaveClass(/locked/);

  const count = core.lessons[0].items.length;
  // Each item once in the intro, then twice in a row in the drill.
  expect(await completeLesson(page, 'basics')).toBe(count * 3);
  await expect(page.getByTestId('lesson-summary')).toContainText('100%');

  await page.goto('/#/neovim/curriculum');
  await expect(page.getByTestId('lesson-core-basics')).toHaveClass(/completed/);
  await expect(page.getByTestId('lesson-core-motions')).toHaveClass(/available/);

  // Progress survives a reload.
  await page.reload();
  await expect(page.getByTestId('lesson-core-basics')).toHaveClass(/completed/);

  // The lesson's drills show up as accuracy in the reference.
  await page.goto('/#/neovim/reference');
  await page.getByRole('searchbox').fill('Save the file');
  await expect(page.getByTestId('reference').locator('tbody tr')).toHaveCount(2);
  await expect(page.getByTestId('reference').locator('tbody tr').first()).toContainText('100% (2/2)');
});

test('a wrong key fails the drill, shows the answer and repeats the item', async ({ page }) => {
  await page.goto('/#/neovim/lesson/core/basics');
  // Finish the intro.
  for (const item of core.lessons[0].items) {
    await expect(page.getByTestId('prompt')).toHaveText(item.prompt);
    await typeKeys(page, item.keys[0]);
  }
  await expect(page.getByTestId('lesson-body')).toHaveAttribute('data-phase', 'drill');
  await expect(page.getByTestId('prompt')).toHaveText(core.lessons[0].items[0].prompt);
  await page.keyboard.press('x');
  await expect(page.getByTestId('feedback')).toContainText('Not quite. The answer is');
  await expect(page.getByTestId('feedback')).toContainText('i');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('prompt')).not.toHaveText(core.lessons[0].items[0].prompt);
});

test('goal drills accept another route but not brute force', async ({ page }) => {
  await seedCompleted(page, ['basics']);
  await page.goto('/#/neovim/lesson/core/motions');
  const feedback = page.getByTestId('feedback');

  // Intro, item 1 (w): brute force runs out of keys.
  await expect(page.getByTestId('prompt')).toHaveText('Move to the start of the next word');
  await typeKeys(page, 'lll');
  await expect(feedback).toContainText('Not quite');
  await page.keyboard.press('Enter');

  // A different command with the same result passes: W instead of w.
  await expect(page.getByTestId('key-budget')).toHaveText('0 / 3 keys');
  await typeKeys(page, 'W');
  await expect(feedback).toHaveText('Correct');
});

for (const lessonId of ['motions', 'operators', 'text-objects']) {
  test(`every item in "${lessonId}" passes with its canonical keys in a real browser`, async ({ page }) => {
    const index = core.lessons.findIndex((l) => l.id === lessonId);
    await seedCompleted(page, core.lessons.slice(0, index).map((l) => l.id));
    const count = core.lessons[index].items.length;
    expect(await completeLesson(page, lessonId)).toBe(count * 3);
    await expect(page.getByTestId('lesson-summary')).toContainText('100%');
  });
}
