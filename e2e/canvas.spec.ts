import { expect, test } from '@playwright/test';

test('minimal canvas flow creates an embed and removes an owned item', async ({
  page
}) => {
  const consoleProblems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(message.text());
    }
  });

  await page.goto('/canvas/');
  await expect(page).toHaveTitle('Canvas');
  await expect(page.getByRole('heading', { name: 'Canvas' })).toBeVisible();
  await expect(page.getByLabel('Your canvas name')).toBeVisible();

  await page.getByTestId('canvas-surface').click({ position: { x: 260, y: 180 } });
  await page.getByLabel('New canvas text').fill('hello from e2e');
  await page.getByLabel('New canvas text').press('Enter');
  await expect(page.getByText('hello from e2e')).toBeVisible();

  await page.getByTestId('canvas-surface').click({ position: { x: 320, y: 340 } });
  await page
    .getByLabel('New canvas text')
    .fill('https://placehold.co/480x260/f8f2e8/201b15.png?text=Canvas');
  await page.getByLabel('New canvas text').press('Enter');
  await expect(
    page.getByAltText('https://placehold.co/480x260/f8f2e8/201b15.png?text=Canvas')
  ).toHaveAttribute(
    'src',
    'https://placehold.co/480x260/f8f2e8/201b15.png?text=Canvas'
  );
  await page.waitForFunction(() => {
    const image = document.querySelector('img');
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
  });

  await page.screenshot({ path: 'test-results/canvas-desktop.png' });

  await page.getByText('hello from e2e').click();
  await expect(page.getByRole('button', { name: 'Delete item' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete item' }).click();
  await expect(page.getByText('hello from e2e')).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/canvas/');
  await page.getByTestId('canvas-surface').click({ position: { x: 40, y: 150 } });
  await page.getByLabel('New canvas text').fill('mobile note');
  await page.getByLabel('New canvas text').press('Enter');
  await expect(page.getByText('mobile note')).toBeVisible();
  await page.screenshot({ path: 'test-results/canvas-mobile.png' });

  expect(consoleProblems).toEqual([]);
});
