import { expect, test } from '@playwright/test';
import { answerUntilSummary, completeLesson, core } from './helpers';

const DAY = '24:00:00';

test('a finished lesson comes due for review on later days', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-10T09:00:00') });
  const count = core.lessons[0].items.length;

  // Day 1: a fresh start offers the first lesson; finishing it schedules its cards.
  await page.goto('/');
  await expect(page.getByTestId('due-count')).toHaveText('0');
  await expect(page.getByTestId('start-lesson')).toBeVisible();
  await completeLesson(page, 'basics');
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(page.getByTestId('due-count')).toHaveText('0');
  await expect(page.getByTestId('streak')).toHaveText('1');
  await expect(page.getByText('Next review tomorrow')).toBeVisible();

  // Day 2: every card is due. Miss the first one, then answer the rest.
  await page.clock.fastForward(DAY);
  await page.reload();
  await expect(page.getByTestId('due-count')).toHaveText(String(count));
  await page.getByTestId('start-review').click();
  await expect(page.getByTestId('prompt')).toBeVisible();
  await page.keyboard.press('x');
  await expect(page.getByTestId('feedback')).toContainText('Not quite');
  await page.keyboard.press('Enter');
  // The missed card comes back once more within the session.
  expect(await answerUntilSummary(page)).toBe(count);
  await expect(page.getByTestId('lesson-summary')).toContainText('Cards reviewed');
  await expect(page.getByTestId('lesson-summary').locator('.missed-list li')).toHaveCount(1);
  await page.getByRole('button', { name: 'Back to Today' }).click();
  await expect(page.getByTestId('due-count')).toHaveText('0');
  await expect(page.getByTestId('streak')).toHaveText('2');

  // Day 3: only the missed card is back; the others were pushed further out.
  await page.clock.fastForward(DAY);
  await page.reload();
  await expect(page.getByTestId('due-count')).toHaveText('1');
});

test('exported progress can be imported again', async ({ page }) => {
  await completeLesson(page, 'basics');
  await page.goto('/#/settings');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export progress' }).click();
  const file = await (await downloading).path();

  page.on('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Delete progress' }).click();
  await expect(page.getByTestId('settings-message')).toHaveText('Progress deleted.');
  await page.goto('/#/neovim/curriculum');
  await expect(page.getByTestId('lesson-core-basics')).toHaveClass(/available/);

  await page.goto('/#/settings');
  await page.getByTestId('import-file').setInputFiles(file);
  await expect(page.getByTestId('settings-message')).toContainText('Imported 1 lessons, 8 cards and 16 attempts');
  await page.goto('/#/neovim/curriculum');
  await expect(page.getByTestId('lesson-core-basics')).toHaveClass(/completed/);
});
