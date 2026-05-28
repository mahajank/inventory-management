import { test, expect } from '@playwright/test'

const pages = [
  { link: 'Overview',        route: '/',           label: 'Dashboard' },
  { link: 'Inventory',       route: '/inventory',  label: 'Inventory' },
  { link: 'Orders',          route: '/orders',     label: 'Orders' },
  { link: 'Finance',         route: '/spending',   label: 'Finance' },
  { link: 'Demand Forecast', route: '/demand',     label: 'Demand Forecast' },
  { link: 'Reports',         route: '/reports',    label: 'Reports' },
  { link: 'Restocking',      route: '/restocking', label: 'Restocking' },
]

for (const { link, route, label } of pages) {
  test(`${label} page loads without error`, async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: link, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(route === '/' ? '/$' : route))

    // Wait for any loading spinner to disappear
    const loading = page.locator('.loading')
    if (await loading.isVisible()) {
      await expect(loading).toBeHidden({ timeout: 10_000 })
    }

    // Page heading should be visible
    await expect(page.locator('h2').first()).toBeVisible()

    // No error banner
    await expect(page.locator('.error').first()).not.toBeVisible()
  })
}
