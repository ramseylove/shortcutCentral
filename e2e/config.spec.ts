import { expect, test } from '@playwright/test';
import { pressToken } from './helpers';

async function applySample(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/#/neovim/config');
  await page.getByRole('button', { name: 'Load the sample' }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByTestId('config-results')).toBeVisible();
}

test('the sample init.lua changes the leader, enables packs and overrides Telescope mappings', async ({ page }) => {
  await applySample(page);
  await expect(page.getByTestId('config-leader')).toHaveText(',');
  await expect(page.getByTestId('config-packs')).toContainText('Telescope, telescope-fzf-native, gitsigns, Neo-tree');
  await expect(page.getByTestId('config-own')).toContainText('5 in the My config pack');
  const findFiles = page.locator('[data-card="neovim/telescope/find-files"]');
  await expect(findFiles).toContainText('<leader>ff');
  await expect(findFiles).toContainText('<leader>sf');
  await expect(page.getByTestId('config-overrides').locator('tr')).toHaveCount(7);
  await expect(page.getByTestId('config-warnings')).toContainText('line 15');
  await expect(page.getByTestId('config-warnings')).toContainText('<leader>x');

  // The packs for the config's plugins are on; the rest are listed with the draft command.
  await page.goto('/#/neovim/plugins');
  for (const name of ['Telescope', 'telescope-fzf-native', 'gitsigns', 'Neo-tree']) {
    await expect(page.getByRole('switch', { name: `Enable ${name}`, exact: true })).toBeChecked();
  }
  await expect(page.getByTestId('plugins-without-pack')).toContainText('npm run pack:draft -- folke/which-key.nvim');

  // The reference shows the config's keys, and it all survives a reload.
  await page.reload();
  await page.goto('/#/neovim/reference');
  const row = page.locator('tr', { hasText: 'Open the file finder' }).first();
  await expect(row).toContainText('config');
});

test('a My config lesson is drilled with the config’s leader', async ({ page }) => {
  await applySample(page);
  await page.goto('/#/neovim/curriculum');
  await page.getByTestId('lesson-my-config-mappings-1').click();

  const body = page.getByTestId('lesson-body');
  const summary = page.getByTestId('lesson-summary');
  const answers: Record<string, string[]> = {
    'Save the file': [',', 'w'],
    'Close the window': [',', 'q'],
    'Clear search highlighting': ['<Esc>'],
    'Copy the selection to the system clipboard (visual mode)': [',', 'y'],
    'Toggle the file tree': [',', 'e'],
  };
  for (;;) {
    await expect(body.or(summary)).toBeVisible();
    if (await summary.isVisible()) break;
    const attempt = await body.getAttribute('data-attempt');
    const prompt = await page.getByTestId('prompt').innerText();
    for (const token of answers[prompt]) await pressToken(page, token);
    await expect(page.getByTestId('feedback')).toHaveText('Correct');
    await expect
      .poll(async () => (await summary.isVisible()) || (await body.getAttribute('data-attempt')) !== attempt)
      .toBe(true);
  }

  await page.goto('/#/neovim/curriculum');
  await expect(page.getByTestId('lesson-my-config-mappings-1')).toHaveClass(/completed|done/);
});

test('a config error is shown with its line and keeps what ran before it', async ({ page }) => {
  await page.goto('/#/neovim/config');
  await page.getByLabel('init.lua').fill("vim.g.mapleader = ';'\nlocal t = nil\nprint(t.x)\n");
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByTestId('config-error')).toContainText('line 3');
  await expect(page.getByTestId('config-leader')).toHaveText(';');
});

test('a config that never finishes is stopped', async ({ page }) => {
  await page.goto('/#/neovim/config');
  await page.getByLabel('init.lua').fill("vim.g.mapleader = ';'\nwhile true do end\n");
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByTestId('config-error')).toContainText('more than 2 seconds', { timeout: 15_000 });
});
