import { expect, request as playwrightRequest, test } from '@playwright/test';
import { signIn } from './auth';

test('teacher2 sees one assigned section and persists attendance', async ({ page }) => {
  await signIn(page, 'teacher2@school.demo');
  await expect(page).toHaveURL(/\/teacher$/);
  await expect(page.getByRole('heading', { name: 'My classes' })).toBeVisible();
  const sectionLink = page.getByRole('link', { name: /Open attendance sheet/ });
  await expect(sectionLink).toHaveCount(1);
  await Promise.all([
    page.waitForURL(/\/teacher\/sections\/[^/]+$/),
    sectionLink.click(),
  ]);
  await expect(page.getByRole('heading', { name: /section attendance/i })).toBeVisible();
  const firstStatus = page.getByLabel(/Status for/).first();
  await firstStatus.selectOption('EXCUSED');
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/attendance') && response.request().method() === 'PUT' && response.ok()),
    page.getByRole('button', { name: 'Save attendance' }).click(),
  ]);
  await page.reload();
  await expect(firstStatus).toHaveValue('EXCUSED');
});

test('teacher2 receives the 404 page for another section', async ({ page }) => {
  const api = await playwrightRequest.newContext({ baseURL: 'http://127.0.0.1:5000' });
  const login = await api.post('/api/v1/auth/login', { data: { email: 'teacher1@school.demo', password: 'Demo@12345' } });
  expect(login.ok()).toBeTruthy();
  const assigned = await api.get('/api/v1/sections');
  const teacherSections = (await assigned.json()).data as Array<{ _id: string }>;
  await api.dispose();
  await signIn(page, 'teacher2@school.demo');
  await expect(page).toHaveURL(/\/teacher$/);
  await page.goto(`/teacher/sections/${teacherSections[1]._id}`);
  await expect(page).toHaveURL(/\/404$/);
  await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible();
});

test('guardian1 sees only linked children', async ({ page }) => {
  await signIn(page, 'guardian1@school.demo');
  await expect(page).toHaveURL(/\/guardian$/);
  await expect(page.getByRole('heading', { name: 'My children' })).toBeVisible();
  await expect(page.getByText('Leo Davis')).toBeVisible();
  await expect(page.getByText('Maya Davis')).toBeVisible();
  await expect(page.getByText('Rohan Patel')).not.toBeVisible();
});
