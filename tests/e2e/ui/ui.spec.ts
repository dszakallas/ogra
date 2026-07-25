import { test, expect } from '@playwright/test';
import { setupUITestEnv, TestEnv } from './testenv';

test.describe('OGRA UI End-to-End Test Suite', () => {
  let env: TestEnv;

  test.beforeAll(() => {
    env = setupUITestEnv('main');
  });

  test.afterAll(() => {
    if (env) {
      env.cleanup();
    }
  });

  test('navigation: dashboard and resources tabs', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.getByRole('link', { name: /Resources/i }).click();
    await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible();

    await page.getByRole('link', { name: /Dashboard/i }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('dashboard: shows kind summary cards', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await expect(page.getByText('All Systems Operational')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Workflows/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Workflow Templates/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Cron Workflows/ })).toBeVisible();
  });

  test('resources: unified list shows all resource kinds', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.getByRole('link', { name: /Resources/i }).click();
    await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'bash-simulation-template', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'periodic-backup-job', exact: true }).first()).toBeVisible();
  });

  test('search: ns: autocomplete creates filter chip', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.getByTestId('search-btn').click();
    await expect(page.getByTestId('global-search-input')).toBeVisible();

    await page.getByTestId('global-search-input').fill('ns:');
    await expect(page.getByTestId(`suggestion-ns-${env.namespace}`)).toBeVisible();
    await page.getByTestId(`suggestion-ns-${env.namespace}`).click();
    await expect(page.getByTestId('chip-ns')).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('search: kind: autocomplete creates filter chip', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    await page.getByTestId('search-btn').click();

    await page.getByTestId('global-search-input').fill('kind:Work');
    await expect(page.getByTestId('suggestion-kind-Workflow')).toBeVisible();

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('chip-kind')).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('search: combined ns: and kind: chips with query', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.getByTestId('search-btn').click();

    await page.getByTestId('global-search-input').fill('ns:');
    await page.getByTestId(`suggestion-ns-${env.namespace}`).click();
    await expect(page.getByTestId('chip-ns')).toBeVisible();

    await page.getByTestId('global-search-input').fill('kind:WorkflowTemplate');
    await page.getByTestId('suggestion-kind-WorkflowTemplate').click();
    await expect(page.getByTestId('chip-kind')).toBeVisible();

    await page.getByTestId('global-search-input').fill('bash');
    await page.waitForTimeout(500);

    const results = page.getByTestId('search-result');
    await expect(results.first()).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('search: ** wildcard shows all resources', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.getByTestId('search-btn').click();
    await page.getByTestId('global-search-input').fill('**');
    await page.waitForTimeout(500);

    const results = page.getByTestId('search-result');
    await expect(results.first()).toBeVisible();

    const count = await results.count();
    expect(count).toBeGreaterThan(1);

    await page.keyboard.press('Escape');
  });

  test('search: recent items appear after navigating from search', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.getByTestId('search-btn').click();
    await page.getByTestId('global-search-input').fill('bash-simulation-template');
    await page.waitForTimeout(500);

    const results = page.getByTestId('search-result');
    await expect(results.first()).toBeVisible();
    await results.first().click();

    await page.waitForTimeout(500);
    await page.getByTestId('search-btn').click();
    await expect(page.getByTestId('search-recent-item')).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('search: chip removal via backspace', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.getByTestId('search-btn').click();

    await page.getByTestId('global-search-input').fill('ns:');
    await page.getByTestId(`suggestion-ns-${env.namespace}`).click();
    await expect(page.getByTestId('chip-ns')).toBeVisible();

    await page.getByTestId('global-search-input').fill('kind:');
    await page.getByTestId('suggestion-kind-Workflow').click();
    await expect(page.getByTestId('chip-kind')).toBeVisible();

    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('chip-kind')).not.toBeVisible();

    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('chip-ns')).not.toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('search: chip removal via X button', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.getByTestId('search-btn').click();

    await page.getByTestId('global-search-input').fill('ns:');
    await page.getByTestId(`suggestion-ns-${env.namespace}`).click();
    await expect(page.getByTestId('chip-ns')).toBeVisible();

    await page.getByTestId('chip-ns').locator('button').click();
    await expect(page.getByTestId('chip-ns')).not.toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('workflow: trigger from template detail and view detail', async ({ page }) => {
    await page.goto(`/#/templates/${env.namespace}/bash-simulation-template`);
    await expect(page.getByTestId('template-detail-badge')).toBeVisible();

    await page.getByRole('button', { name: 'Trigger Workflow' }).click();
    await expect(page.getByText('SUBMIT WORKFLOW')).toBeVisible();
    await page.getByRole('button', { name: 'Launch Workflow' }).click();
    await expect(page).toHaveURL(new RegExp(`/workflows/${env.namespace}/bash-simulation-template-`), { timeout: 15000 });

    await expect(page.getByRole('button', { name: 'SUMMARY' })).toBeVisible();
    await expect(page.getByText('SUBMISSION PARAMETERS')).toBeVisible();
    await expect(page.getByText('NODE STATS')).toBeVisible();
    await expect(page.getByText('METADATA DETAILS')).toBeVisible();
  });

  test('workflow: custom parameters via trigger modal', async ({ page }) => {
    await page.goto(`/#/templates/${env.namespace}/bash-simulation-template`);
    await page.getByRole('button', { name: 'Trigger Workflow' }).click();

    await expect(page.getByText('SUBMIT WORKFLOW')).toBeVisible();
    await expect(page.getByText('Dynamic Template Parameters')).toBeVisible();

    const paramInput = page.locator('input[type="text"]').first();
    await expect(paramInput).toBeVisible();
    await paramInput.clear();
    await paramInput.fill('3');

    await page.getByRole('button', { name: 'Launch Workflow' }).click();
    await expect(page).toHaveURL(new RegExp(`/workflows/${env.namespace}/bash-simulation-template-`), { timeout: 15000 });

    await expect(page.getByText('SUBMISSION PARAMETERS')).toBeVisible();
    await expect(page.getByText('sleep-duration')).toBeVisible();
    await expect(page.getByText('3', { exact: true })).toBeVisible();
  });

  test('workflow detail: tabs navigation', async ({ page }) => {
    await page.goto(`/#/templates/${env.namespace}/python-data-pipeline`);
    await page.getByRole('button', { name: 'Trigger Workflow' }).click();
    await expect(page.getByText('SUBMIT WORKFLOW')).toBeVisible();
    await page.getByRole('button', { name: 'Launch Workflow' }).click();
    await expect(page).toHaveURL(new RegExp(`/workflows/${env.namespace}/python-data-pipeline-`), { timeout: 15000 });

    await page.getByRole('button', { name: 'NODES' }).click();
    await expect(page.getByText('Execution Nodes Tree')).toBeVisible();

    await page.getByRole('button', { name: 'TIMELINE' }).click();
    await expect(page.getByText('Sequential Execution Timeline')).toBeVisible();

    await page.getByRole('button', { name: 'LOGS' }).click();
    await expect(page.getByText('Awaiting streaming cluster events...')).toBeVisible({ timeout: 10000 });
  });

  test('workflow detail: back button navigates to resources', async ({ page }) => {
    await page.goto(`/#/templates/${env.namespace}/bash-simulation-template`);
    await page.getByRole('button', { name: 'Trigger Workflow' }).click();
    await page.getByRole('button', { name: 'Launch Workflow' }).click();
    await expect(page).toHaveURL(new RegExp(`/workflows/${env.namespace}/bash-simulation-template-`), { timeout: 15000 });

    await page.getByTestId('workflow-detail-back-btn').click();
    await expect(page).toHaveURL(/\/#\/resources/);
  });

  test('workflow detail: delete workflow', async ({ page }) => {
    await page.goto(`/#/templates/${env.namespace}/bash-simulation-template`);
    await page.getByRole('button', { name: 'Trigger Workflow' }).click();
    await expect(page.getByText('SUBMIT WORKFLOW')).toBeVisible();
    await page.getByRole('button', { name: 'Launch Workflow' }).click();
    await expect(page).toHaveURL(new RegExp(`/workflows/${env.namespace}/bash-simulation-template-`), { timeout: 15000 });

    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(2000);

    page.on('dialog', (dialog) => dialog.accept());
    await page.getByTestId('workflow-actions-menu').click();
    await page.getByRole('button', { name: /Delete workflow/i }).click();
    await page.waitForTimeout(2000);

    await expect(page).toHaveURL(/\/#\/resources/);
  });

  test('workflow detail: action menu has resubmit and delete', async ({ page }) => {
    await page.goto(`/#/templates/${env.namespace}/bash-simulation-template`);
    await page.getByRole('button', { name: 'Trigger Workflow' }).click();
    await expect(page.getByText('SUBMIT WORKFLOW')).toBeVisible();
    await page.getByRole('button', { name: 'Launch Workflow' }).click();
    await expect(page).toHaveURL(new RegExp(`/workflows/${env.namespace}/bash-simulation-template-`), { timeout: 15000 });

    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(2000);

    await page.getByTestId('workflow-actions-menu').click();
    await expect(page.getByRole('button', { name: /Resubmit/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Delete/i })).toBeVisible();
  });

  test('cron workflow: detail and suspend toggle', async ({ page }) => {
    await page.goto(`/#/cron/${env.namespace}/periodic-backup-job`);
    await expect(page).toHaveURL(new RegExp(`/cron/${env.namespace}/periodic-backup-job`));

    await expect(page.getByText('CRON JOB TIMING')).toBeVisible();
    await expect(page.getByText('STATISTICS')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trigger Run Now' })).toBeVisible();

    await page.getByRole('button', { name: /Suspend Schedule/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText('SUSPENDED', { exact: true })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Activate Schedule/i }).click();
    await page.waitForTimeout(1000);
    await expect(page.getByText('ACTIVE', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('cron workflow: trigger navigates to new workflow', async ({ page }) => {
    await page.goto(`/#/cron/${env.namespace}/periodic-backup-job`);
    await page.getByRole('button', { name: 'Trigger Run Now' }).click();
    await expect(page).toHaveURL(new RegExp(`/workflows/${env.namespace}/periodic-backup-job-`), { timeout: 15000 });
  });

  test('template detail: instantiated workflows section', async ({ page }) => {
    await page.goto(`/#/templates/${env.namespace}/bash-simulation-template`);
    await expect(page.getByTestId('template-detail-badge')).toBeVisible();

    await expect(page.getByText(/INSTANTIATED WORKFLOWS/)).toBeVisible();
    await expect(page.getByText('DESCRIPTION', { exact: true })).toBeVisible();
    await expect(page.getByText('STATISTICS', { exact: true })).toBeVisible();
  });

  test('workflow detail: source template link navigates to template detail', async ({ page }) => {
    await page.goto(`/#/templates/${env.namespace}/bash-simulation-template`);
    await page.getByRole('button', { name: 'Trigger Workflow' }).click();
    await expect(page.getByText('SUBMIT WORKFLOW')).toBeVisible();
    await page.getByRole('button', { name: 'Launch Workflow' }).click();
    await expect(page).toHaveURL(new RegExp(`/workflows/${env.namespace}/bash-simulation-template-`), { timeout: 15000 });

    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await expect(page.getByText('SOURCE TEMPLATE:')).toBeVisible();
    const sourceTemplateLink = page.getByRole('button', { name: 'bash-simulation-template' });
    await sourceTemplateLink.click();

    await expect(page).toHaveURL(new RegExp(`/templates/${env.namespace}/bash-simulation-template`));
    await expect(page.getByTestId('template-detail-badge')).toBeVisible();
  });

  test('global search: overlay opens and finds resources', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.getByTestId('search-btn').click();
    await expect(page.getByTestId('global-search-input')).toBeVisible();

    await page.getByTestId('global-search-input').fill('bash');
    await page.waitForTimeout(500);

    const results = page.getByTestId('search-result');
    await expect(results.first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('global-search-input')).not.toBeVisible();
  });

  test('global search: keyboard shortcut "/" opens overlay', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(500);

    await page.keyboard.press('/');
    await expect(page.getByTestId('global-search-input')).toBeVisible();
  });

  test('resources: favorites tab shows favorited resources', async ({ page }) => {
    await page.goto(`/#/templates/${env.namespace}/bash-simulation-template`);
    await expect(page.getByTestId('template-detail-badge')).toBeVisible();

    await page.getByRole('link', { name: /Resources/i }).click();
    await page.waitForTimeout(1000);

    const favoriteBtn = page.locator('button[title="Add to favorites"]').first();
    await expect(favoriteBtn).toBeVisible({ timeout: 10000 });
    await favoriteBtn.click();
    await page.waitForTimeout(500);

    await page.getByTestId('tab-favorites').click();
    await page.waitForTimeout(500);

    await expect(page.locator('button[title="Remove from favorites"]').first()).toBeVisible();
  });

  test('resources: events tab shows activity feed', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);
    await page.getByRole('link', { name: /Resources/i }).click();
    await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible();

    await page.getByTestId('tab-events').click();
    await page.waitForTimeout(500);

    const eventsTab = page.getByTestId('tab-events');
    await expect(eventsTab).toBeVisible();
  });
});
