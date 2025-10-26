import { execSync, type ExecException } from 'node:child_process';
import { resolve } from 'node:path';

describe('CLI', () => {
  const cliPath = resolve(process.cwd(), 'dist/index.js');
  const summaryJsonPath = resolve(process.cwd(), 'tests/summary.json');

  beforeAll(() => {
    // Ensure the CLI is built before running tests
    execSync('pnpm build', { cwd: process.cwd() });
  });

  it('should display error when no file is provided', () => {
    try {
      execSync(`node ${cliPath}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      fail('Expected command to throw');
    } catch (error) {
      const execError = error as ExecException;
      expect(execError.stderr?.toString()).toContain('No input file specified');
    }
  });

  it('should display error for invalid JSON file', () => {
    const invalidJsonPath = resolve(process.cwd(), 'tests/invalid.json');

    try {
      execSync(`node ${cliPath} ${invalidJsonPath}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error) {
      const execError = error as ExecException;
      expect(execError.stderr?.toString()).toContain('Unable to read or parse');
    }
  });

  it('should display version', () => {
    const output = execSync(`node ${cliPath} --version`, {
      encoding: 'utf-8',
    });

    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('should display help', () => {
    const output = execSync(`node ${cliPath} --help`, {
      encoding: 'utf-8',
    });

    expect(output).toMatchInlineSnapshot(`
     "Usage: turborepo-summary [options] <file>

     Generate a human-readable summary report from Turborepo run summary JSON output

     Arguments:
       file           Path to the Turbo run summary JSON file

     Options:
       -V, --version  output the version number
       -h, --help     display help for command
     "
    `);
  });

  it('should generate a markdown report from turbo summary JSON', () => {
    const output = execSync(`node ${cliPath} ${summaryJsonPath}`, {
      encoding: 'utf-8',
      env: { ...process.env, TZ: 'UTC' },
    });

    // Normalize the timestamp to make snapshots stable
    const normalizedOutput = output.replace(
      /_Generated on .+_/,
      '_Generated on [timestamp]_',
    );

    expect(normalizedOutput).toMatchInlineSnapshot(`
     "# 🔍 Turbo Run Report

     > **Command:** \`turbo run check-types\`

     ## 📊 Summary

     | Metric | Value |
     |--------|-------|
     | **Total Duration** | 0.03s (26ms) |
     | **Tasks Executed** | 3 |
     | **Successful** | ✓ 3 |
     | **Failed** | ✗ 0 |
     | **Cache Hits** | 🎯 3 |
     | **Cache Misses** | ⚠️ 0 |

     ## 📈 Execution Timeline

     \`\`\`mermaid
     gantt
         title Turbo Execution Timeline
         dateFormat x
         axisFormat %S.%L
         section Tasks
         @repo/ui#check-types 12ms cached ✓ : 1761146561000, 1761146561012
         web#check-types 13ms cached ✓ : 1761146561013, 1761146561026
         docs#check-types 12ms cached ✓ : 1761146561014, 1761146561026
     \`\`\`

     ## 📋 Detailed Results

     | Task | Duration | Cache | Status |
     |------|----------:|-------|--------|
     | \`@repo/ui#check-types\` | 12ms | 🎯 Hit | ✅ Success |
     | \`web#check-types\` | 13ms | 🎯 Hit | ✅ Success |
     | \`docs#check-types\` | 12ms | 🎯 Hit | ✅ Success |

     ---

     _Generated on [timestamp]_
     "
    `);
  });
});
