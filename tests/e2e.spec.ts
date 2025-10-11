import { test, expect } from '@playwright/test';

const QUADRANTS = [
  { id: 'Q1', title: 'Срочно + Важно' },
  { id: 'Q2', title: 'Несрочно + Важно' },
  { id: 'Q3', title: 'Срочно + Неважно' },
  { id: 'Q4', title: 'Несрочно + Неважно' },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test('renders main dashboard sections for an empty workspace', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 2, name: 'Бэклог', exact: true })).toBeVisible();
  await expect(page.getByText('Все задачи распределены по квадрантам')).toBeVisible();

  for (const quadrant of QUADRANTS) {
    await expect(page.getByRole('heading', { level: 3, name: quadrant.title, exact: true })).toBeVisible();
    await expect(page.locator(`#quadrant-${quadrant.id}`).getByText('Перетащите задачу сюда')).toBeVisible();
  }
});

test('allows creating a task via the quick add modal and placing it into a quadrant', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Добавить задачу в квадрант Q1', exact: true }).click({ force: true });

  const dialog = page.getByRole('dialog', { name: 'Добавление задач' });
  await expect(dialog).toBeVisible();

  const taskTitle = 'Playwright проверка задачи';

  await dialog.getByLabel('Название').fill(taskTitle);
  await dialog.getByLabel('Квадрант').selectOption('Q1');
  await dialog.getByRole('button', { name: 'Добавить задачу' }).click();
  await expect(dialog.getByText('Задача добавлена')).toBeVisible();

  await page.getByLabel('Закрыть окно').click();

  const q1DropArea = page.locator('#quadrant-Q1');
  await expect(q1DropArea.getByRole('button', { name: taskTitle })).toBeVisible();
});
