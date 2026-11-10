import { expect, request as playwrightRequest, test } from '@playwright/test';

async function signIn(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Demo@12345');
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('teacher enters marks and guardian opens only published report cards', async ({ page }) => {
  await signIn(page, 'teacher3@school.demo');
  await page.goto('/teacher/exams');
  await expect(page.getByRole('heading', { name: 'My exams' })).toBeVisible();
  await page.getByRole('link', { name: /Demo Open Examination/ }).click();
  await expect(page.getByRole('heading', { name: 'Demo Open Examination' })).toBeVisible();
  const marks = page.getByLabel(/Marks for/).first();
  await marks.fill('77.77');
  await page.getByRole('button', { name: 'Save marks' }).click();
  await expect(page.getByText('Marks saved')).toBeVisible();
  await page.reload();
  await expect(marks).toHaveValue('77.77');

  const api = await playwrightRequest.newContext({ baseURL: 'http://127.0.0.1:5000' });
  const adminLogin = await api.post('/api/v1/auth/login', { data: { email: 'admin@school.demo', password: 'Demo@12345' } });
  expect(adminLogin.ok()).toBeTruthy();
  const exams = await api.get('/api/v1/exams?pageSize=100');
  const examRows = (await exams.json()).data as Array<{ _id: string; status: string }>;
  const unpublished = examRows.find((exam) => exam.status === 'MARKS_OPEN')!;
  const students = await api.get('/api/v1/students?pageSize=1');
  const student = (await students.json()).data[0] as { _id: string };
  await api.dispose();

  await signIn(page, 'guardian1@school.demo');
  await page.goto('/guardian');
  await expect(page.getByRole('heading', { name: 'Published report cards' })).toBeVisible();
  const reportLink = page.getByRole('link', { name: /Published report card/ }).first();
  await expect(reportLink).toBeVisible();
  await reportLink.click();
  await expect(page.getByRole('heading', { name: /Report card/ })).toBeVisible();
  await page.goto(`/guardian/report-cards/${student._id}/${unpublished._id}`);
  await expect(page).toHaveURL(/\/404$/);
  await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible();
});
