import { execSync, type ExecException } from 'node:child_process';
import { resolve } from 'node:path';

describe('CLI', () => {
  const cliPath = resolve(process.cwd(), 'dist/cli.js');

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
});
