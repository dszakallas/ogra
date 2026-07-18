import { test, expect } from '@playwright/test';
import { setupUITestEnv, TestEnv } from './testenv';

function templateCard(page: any, name: string, namespace: string) {
  return page.locator('h2', { hasText: name }).locator('..').locator('..').locator('..').filter({ hasText: namespace });
}

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

  test('navigation: tabs and namespace filtering', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Workflow Runs' })).toBeVisible();

    await page.getByRole('link', { name: /Templates/i }).click();
    await expect(page.getByRole('heading', { name: 'Workflow Templates' })).toBeVisible();

    await page.getByRole('link', { name: /Cron/i }).click();
    await expect(page.getByRole('heading', { name: 'Cron Workflows' })).toBeVisible();

    await page.getByRole('link', { name: /Runs/i }).click();
    await expect(page.getByRole('heading', { name: 'Workflow Runs' })).toBeVisible();
  });

  test('workflow templates: list, submit with parameters, and view detail', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.locator('select').first().selectOption(env.namespace);

    await page.getByRole('link', { name: /Templates/i }).click();
    await expect(page.getByRole('heading', { name: 'Workflow Templates' })).toBeVisible();

    const bashHeading = page.getByRole('heading', { name: 'bash-simulation-template', exact: true });
    await expect(bashHeading).toBeVisible();

    const bashCard = bashHeading.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]');
    await bashCard.getByRole('button', { name: /Trigger/i }).click();

    await expect(page.getByText('SUBMIT WORKFLOW')).toBeVisible();

    const paramInput = page.locator('input[type="text"]').first();
    await expect(paramInput).toBeVisible();
    await paramInput.fill('3');

    await page.getByRole('button', { name: 'Launch Workflow' }).click();

    await expect(page).toHaveURL(new RegExp(`/workflows/${env.namespace}/bash-simulation-template-`), { timeout: 15000 });

    await expect(page.getByRole('button', { name: 'SUMMARY' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'NODES' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'TIMELINE' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'LOGS' })).toBeVisible();

    await expect(page.getByText('SUBMISSION PARAMETERS')).toBeVisible();
    await expect(page.getByText('sleep-duration')).toBeVisible();
    await expect(page.getByText('NODE STATS')).toBeVisible();
    await expect(page.getByText('METADATA DETAILS')).toBeVisible();
  });

  test('workflow detail: tabs navigation', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.locator('select').first().selectOption(env.namespace);

    await page.getByRole('link', { name: /Templates/i }).click();

    const pythonHeading = page.getByRole('heading', { name: 'python-data-pipeline', exact: true });
    await expect(pythonHeading).toBeVisible();
    const pythonCard = pythonHeading.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]');
    await pythonCard.getByRole('button', { name: /Trigger/i }).click();

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

  test('workflow list: phase filtering and search', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.locator('select').first().selectOption(env.namespace);
    await page.waitForTimeout(2000);

    await expect(page.getByRole('button', { name: /^ALL$/ })).toBeVisible();

    await page.getByRole('button', { name: /Running/i }).click();
    await page.getByRole('button', { name: /^ALL$/ }).click();

    const searchInput = page.getByPlaceholder('Search runs by name...');
    await searchInput.fill('nonexistent-workflow-xyz');
    await expect(page.getByText('No runs matched')).toBeVisible();
    await searchInput.fill('');
  });

  test('cron workflows: list, detail, and suspend toggle', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.getByRole('link', { name: /Cron/i }).click();
    await expect(page.getByRole('heading', { name: 'Cron Workflows' })).toBeVisible();

    await page.locator('select').first().selectOption(env.namespace);
    await page.waitForTimeout(1000);

    const cronHeading = page.getByRole('heading', { name: 'periodic-backup-job', exact: true });
    await expect(cronHeading).toBeVisible();
    const cronCard = cronHeading.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]');
    await expect(cronCard.getByText('Every minute')).toBeVisible();

    await cronCard.click();
    await expect(page).toHaveURL(new RegExp(`/cron/${env.namespace}/periodic-backup-job`));

    await expect(page.getByText('CRON JOB TIMING')).toBeVisible();
    await expect(page.getByText('Every minute')).toBeVisible();
    await expect(page.getByText('* * * * *')).toBeVisible();
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
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.getByRole('link', { name: /Cron/i }).click();
    await page.locator('select').first().selectOption(env.namespace);
    await page.waitForTimeout(1000);

    const cronHeading = page.getByRole('heading', { name: 'periodic-backup-job', exact: true });
    const cronCard = cronHeading.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]');
    await cronCard.click();
    await expect(page).toHaveURL(new RegExp(`/cron/${env.namespace}/periodic-backup-job`));

    await page.getByRole('button', { name: 'Trigger Run Now' }).click();

    await expect(page).toHaveURL(new RegExp(`/workflows/${env.namespace}/periodic-backup-job-`), { timeout: 15000 });
  });

  test('workflow detail: delete workflow', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.locator('select').first().selectOption(env.namespace);

    await page.getByRole('link', { name: /Templates/i }).click();

    const bashHeading = page.getByRole('heading', { name: 'bash-simulation-template', exact: true });
    const bashCard = bashHeading.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]');
    await bashCard.getByRole('button', { name: /Trigger/i }).click();
    await page.getByRole('button', { name: 'Launch Workflow' }).click();
    await expect(page).toHaveURL(new RegExp(`/workflows/${env.namespace}/bash-simulation-template-`), { timeout: 15000 });

    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(2000);

    page.on('dialog', (dialog) => dialog.accept());

    await page.getByTestId('workflow-actions-menu').click();

    await page.getByRole('button', { name: /Delete workflow/i }).click();
    await page.waitForTimeout(2000);

    await expect(page).toHaveURL(/\/#\/$/);
  });

  test('workflow detail: action menu has resubmit and delete', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.locator('select').first().selectOption(env.namespace);

    await page.getByRole('link', { name: /Templates/i }).click();

    const bashHeading = page.getByRole('heading', { name: 'bash-simulation-template', exact: true });
    const bashCard = bashHeading.locator('xpath=ancestor::div[contains(@class, "rounded-2xl")]');
    await bashCard.getByRole('button', { name: /Trigger/i }).click();
    await page.getByRole('button', { name: 'Launch Workflow' }).click();
    await expect(page).toHaveURL(new RegExp(`/workflows/${env.namespace}/bash-simulation-template-`), { timeout: 15000 });

    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(2000);

    await page.getByTestId('workflow-actions-menu').click();

    await expect(page.getByRole('button', { name: /Resubmit/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Delete/i })).toBeVisible();
  });

  test('template list: shows parameter and template counts', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.locator('select').first().selectOption(env.namespace);

    await page.getByRole('link', { name: /Templates/i }).click();

    await expect(page.getByText('PARAMETERS: 1')).toBeVisible();
    await expect(page.getByText('TEMPLATES: 3')).toBeVisible();
    await expect(page.getByText('PARAMETERS: 2')).toBeVisible();
    await expect(page.getByText('TEMPLATES: 4')).toBeVisible();
  });

  test('template list: search filters templates by name', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.locator('select').first().selectOption(env.namespace);

    await page.getByRole('link', { name: /Templates/i }).click();

    await expect(page.getByRole('heading', { name: 'python-data-pipeline', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'bash-simulation-template', exact: true })).toBeVisible();

    const searchInput = page.getByPlaceholder('Search templates by name...');
    await searchInput.fill('python-data-pipeline');

    await expect(page.getByRole('heading', { name: 'python-data-pipeline', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'bash-simulation-template', exact: true })).not.toBeVisible();

    await searchInput.fill('');
    await expect(page.getByRole('heading', { name: 'bash-simulation-template', exact: true })).toBeVisible();
  });

  test('namespace isolation: only shows resources from selected namespace', async ({ page }) => {
    await page.goto('/');
    await page.getByTitle('Refresh current data').click();
    await page.waitForTimeout(1000);

    await page.locator('select').first().selectOption(env.namespace);

    await page.getByRole('link', { name: /Templates/i }).click();

    await expect(page.getByRole('heading', { name: 'bash-simulation-template', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'python-data-pipeline', exact: true })).toBeVisible();

    const templateHeadings = page.locator('main h2');
    const count = await templateHeadings.count();
    expect(count).toBe(2);
  });
});
