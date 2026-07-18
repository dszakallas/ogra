import { execSync } from 'child_process';

export interface TestEnv {
  namespace: string;
  cleanup: () => void;
}

export function setupUITestEnv(suiteName: string): TestEnv {
  const namespace = execSync(`testbed setup ${suiteName}`, { encoding: 'utf8' }).trim();

  const cleanup = () => {
    try {
      execSync(`testbed teardown ${namespace}`);
    } catch {
      // Ignore teardown errors
    }
  };

  return { namespace, cleanup };
}
