import { test, expect } from '@playwright/test'

test.describe('Restocking page', () => {
  const slider = (page) => page.locator('input[type="range"].budget-slider')
  const budgetCard = (page) => page.locator('.stat-card').filter({ hasText: /^Budget/ }).locator('.stat-value')
  const selectedTotalCard = (page) => page.locator('.stat-card').filter({ hasText: 'Selected Total' }).locator('.stat-value')
  const remainingCard = (page) => page.locator('.stat-card').filter({ hasText: 'Remaining Budget' })
  const checkboxes = (page) => page.locator('input.item-check')
  const checkedBoxes = (page) => page.locator('input.item-check:checked')
  const dimmedRows = (page) => page.locator('tr.row-dimmed')
  const orderBtn = (page) => page.getByRole('button', { name: /Place Order/ })

  async function setSlider(page, value) {
    // Use evaluate to set value + dispatch input event for Vue v-model reactivity
    await slider(page).evaluate((el, v) => {
      el.value = String(v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, value)
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/restocking')
    await expect(page.locator('.loading')).toBeHidden({ timeout: 15_000 })
  })

  test('table loads with recommendations', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible()
    const rows = page.locator('tbody tr')
    await expect(rows).toHaveCount(await rows.count())
    expect(await rows.count()).toBeGreaterThan(0)
    await expect(page.locator('.card-title').filter({ hasText: 'Recommended Restocking' })).toBeVisible()
  })

  test('budget slider defaults to $50,000', async ({ page }) => {
    await expect(slider(page)).toHaveValue('50000')
    await expect(budgetCard(page)).toContainText('50,000')
  })

  test('slider updates Budget stat card live', async ({ page }) => {
    await setSlider(page, 75000)
    await expect(budgetCard(page)).toContainText('75,000')
  })

  test('items are auto-checked on load when total_cost <= budget', async ({ page }) => {
    const count = await checkedBoxes(page).count()
    expect(count).toBeGreaterThan(0)
    const totalText = await selectedTotalCard(page).textContent()
    expect(totalText).not.toBe('$0.00')
  })

  test('dimmed rows exist for unchecked items above budget', async ({ page }) => {
    // All items are auto-checked at $50K load. Set budget to $0 and uncheck one item —
    // that item (total_cost > 0 = budget) must then be dimmed.
    await setSlider(page, 0)
    await checkedBoxes(page).first().click()
    const count = await dimmedRows(page).count()
    expect(count).toBeGreaterThan(0)
    // Dimmed rows must not contain a checked checkbox
    for (const row of await dimmedRows(page).all()) {
      const checked = await row.locator('input.item-check:checked').count()
      expect(checked).toBe(0)
    }
  })

  test('toggling a checkbox updates Selected Total', async ({ page }) => {
    const firstChecked = checkedBoxes(page).first()
    const totalBefore = await selectedTotalCard(page).textContent()

    // Uncheck it
    await firstChecked.click()
    const totalAfter = await selectedTotalCard(page).textContent()
    expect(totalAfter).not.toBe(totalBefore)

    // Re-check it (now it's unchecked, so click the corresponding unchecked box)
    // Re-navigate to get a clean state for a simpler assertion
    await page.goto('/restocking')
    await expect(page.locator('.loading')).toBeHidden({ timeout: 15_000 })
    const totalRestored = await selectedTotalCard(page).textContent()
    expect(totalRestored).toBe(totalBefore)
  })

  test('Remaining Budget stat card gets danger class when budget goes negative', async ({ page }) => {
    // Set budget to $0 so remaining = 0 - selectedTotal < 0
    await setSlider(page, 0)

    // Click the first checkbox that's currently unchecked (all should be unchecked now since
    // budget=0 means initial auto-check selects nothing; or if pre-checked, uncheck then recheck)
    const allBoxes = checkboxes(page)
    const firstBox = allBoxes.first()
    const isChecked = await firstBox.isChecked()
    if (!isChecked) {
      await firstBox.click()
    }

    await expect(remainingCard(page)).toHaveClass(/danger/)
  })

  test('Place Order flow: submit, success message, selections cleared', async ({ page }) => {
    // Uncheck all items (loop until none remain — index-based locators break as items get unchecked)
    while (await checkedBoxes(page).count() > 0) {
      await checkedBoxes(page).first().click()
    }
    await expect(orderBtn(page)).toBeDisabled()

    // Check one item
    await checkboxes(page).first().click()
    await expect(orderBtn(page)).toBeEnabled()
    await expect(orderBtn(page)).toContainText('1 item')

    // Submit
    await orderBtn(page).click()
    await expect(page.locator('.success-msg')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.success-msg')).toContainText(/Order RST-\d{14} submitted/)

    // Selections cleared
    await expect(checkedBoxes(page)).toHaveCount(0)
    await expect(orderBtn(page)).toBeDisabled()
  })
})
