import { expect, test } from '@playwright/test';
import { signIn } from './auth';

test('admin signs in, creates a student, and finds it in the list', async ({ page }) => {
  test.setTimeout(60_000);
  const admissionNumber = `E2E-${Date.now()}`;
  await signIn(page, 'admin@school.demo');
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/students');
  await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible();
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByLabel('Admission number').fill(admissionNumber);
  await page.getByLabel('Full name').fill('E2E Student');
  await page.getByLabel('Date of birth').fill('2012-01-15');
  await page.getByLabel('Gender').fill('OTHER');
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/students') && request.method() === 'POST') console.log('student-request', request.postData());
  });
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByLabel('Search Students').fill(admissionNumber);
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText(admissionNumber)).toBeVisible();
});
