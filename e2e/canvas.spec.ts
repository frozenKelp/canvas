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
  await expect(page.getByRole('button', { name: 'Transform item' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resize item' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rotate item' })).toHaveCount(0);

  const world = page.locator('.canvas-world');
  const beforePan = await world.evaluate((node) =>
    getComputedStyle(node).transform
  );
  await page.keyboard.down('m');
  await expect(page.locator('.canvas-app')).toHaveClass(/is-move-mode/);
  await world.hover({ position: { x: 950, y: 720 } });
  await page.mouse.down();
  await page.mouse.move(1030, 760);
  await page.mouse.up();
  await page.keyboard.up('m');
  await expect
    .poll(() => world.evaluate((node) => getComputedStyle(node).transform))
    .not.toBe(beforePan);

  await page.keyboard.down('m');
  await page.mouse.move(640, 480);
  await page.mouse.wheel(0, -240);
  await page.keyboard.up('m');
  await expect
    .poll(() => world.evaluate((node) => getComputedStyle(node).transform))
    .not.toBe(beforePan);

  await page.getByTestId('canvas-surface').click({ position: { x: 520, y: 300 } });
  await page.getByLabel('New canvas text').fill('https://example.com/story');
  await page.getByLabel('New canvas text').press('Enter');
  await expect(page.getByText('preview unavailable')).toBeVisible();
  await expect(page.getByRole('link', { name: 'open' })).toHaveAttribute(
    'href',
    'https://example.com/story'
  );

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
