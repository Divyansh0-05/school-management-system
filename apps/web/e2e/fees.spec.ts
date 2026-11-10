import { expect, test } from '@playwright/test';
import { signIn } from './auth';

test('guardian retries a simulated payment and admin verifies reconciliation', async ({ page }) => {
  await signIn(page, 'guardian1@school.demo');
  await page.goto('/guardian');
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
  const invoiceLink = page.getByRole('link').filter({ hasText: /PARTIALLY_PAID/ }).first();
  const invoiceText = await invoiceLink.innerText();
  const invoiceNo = invoiceText.match(/INV-\S+/)?.[0] || '';
  await invoiceLink.click();
  await expect(page.getByRole('heading', { name: /INV-/ })).toBeVisible();
  await page.getByRole('link', { name: 'Pay (simulated)' }).click();
  await expect(page.getByText('SIMULATED — no real money moves')).toBeVisible();
  await page.getByLabel('Outcome').selectOption('FAILED');
  await page.getByRole('button', { name: 'Pay simulated' }).click();
  await expect(page.getByText(/balance is unchanged/i)).toBeVisible();
  await page.getByLabel('Outcome').selectOption('SUCCEEDED');
  await page.getByRole('button', { name: 'Pay simulated' }).click();
  await expect(page.getByText(/Payment recorded successfully/i)).toBeVisible();

  await signIn(page, 'admin@school.demo');
  await page.goto('/admin/invoices');
  await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(`${invoiceNo}.*PAID`) })).toBeVisible();
  await page.goto('/admin/reports/fees');
  await expect(page.getByText('All invoices reconcile')).toBeVisible();
});
