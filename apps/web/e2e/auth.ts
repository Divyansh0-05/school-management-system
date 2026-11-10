import type { Page } from '@playwright/test';

export async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Demo@12345');
  await Promise.all([
    page.waitForURL(/\/(teacher|admin|guardian)/),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ]);
}
