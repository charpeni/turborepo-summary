import { execSync, type ExecException } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

function touchIfExists(path: string, atime: Date, mtime: Date = atime): void {
  try {
    utimesSync(path, atime, mtime);
  } catch {
    // ignore — file may not exist
  }
}

describe('CLI', () => {
  const cliPath = resolve(process.cwd(), 'dist/cli.js');
  const summaryPath = resolve(process.cwd(), 'tests/summary.json');

  beforeAll(() => {
    // Ensure the CLI is built before running tests
    execSync('pnpm build', { cwd: process.cwd() });
  });

  it('should default to the newest .turbo/runs/*.json when no file is given', () => {
    const tmpRoot = resolve(
      tmpdir(),
      `turborepo-summary-default-${Date.now()}`,
    );
    const runsDir = join(tmpRoot, '.turbo', 'runs');
    mkdirSync(runsDir, { recursive: true });
    // older file
    writeFileSync(
      join(runsDir, 'older.json'),
      readFileSync(summaryPath, 'utf-8'),
    );
    // Give the older file an older mtime so the newer one wins regardless of FS timing.
    const olderTime = new Date(Date.now() - 60_000);
    touchIfExists(join(runsDir, 'older.json'), olderTime, olderTime);
    // newer file
    writeFileSync(
      join(runsDir, 'newer.json'),
      readFileSync(summaryPath, 'utf-8'),
    );

    try {
      const output = execSync(`node ${cliPath}`, {
        encoding: 'utf-8',
        cwd: tmpRoot,
        stdio: 'pipe',
      });
      expect(output).toContain('## 📊 Summary');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('should error helpfully when no file is given and .turbo/runs/ is empty', () => {
    const tmpRoot = resolve(tmpdir(), `turborepo-summary-empty-${Date.now()}`);
    const runsDir = join(tmpRoot, '.turbo', 'runs');
    mkdirSync(runsDir, { recursive: true });

    try {
      try {
        execSync(`node ${cliPath}`, {
          encoding: 'utf-8',
          cwd: tmpRoot,
          stdio: 'pipe',
        });
        fail('Expected command to throw');
      } catch (error) {
        const execError = error as ExecException;
        const stderr = execError.stderr?.toString() ?? '';
        expect(stderr).toContain('.turbo/runs');
      }
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('should error helpfully when no file is given and .turbo/runs/ does not exist', () => {
    const tmpRoot = resolve(tmpdir(), `turborepo-summary-nodir-${Date.now()}`);
    mkdirSync(tmpRoot, { recursive: true });

    try {
      try {
        execSync(`node ${cliPath}`, {
          encoding: 'utf-8',
          cwd: tmpRoot,
          stdio: 'pipe',
        });
        fail('Expected command to throw');
      } catch (error) {
        const execError = error as ExecException;
        const stderr = execError.stderr?.toString() ?? '';
        expect(stderr).toContain('.turbo/runs');
      }
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('should read JSON from stdin when file is "-"', () => {
    const stdin = readFileSync(summaryPath, 'utf-8');
    const output = execSync(`node ${cliPath} -`, {
      encoding: 'utf-8',
      input: stdin,
      stdio: 'pipe',
    });
    expect(output).toContain('## 📊 Summary');
  });

  it('should write markdown to -o file instead of stdout', () => {
    const tmpOut = resolve(tmpdir(), `turborepo-summary-out-${Date.now()}.md`);
    try {
      execSync(`node ${cliPath} ${summaryPath} -o ${tmpOut}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      const written = readFileSync(tmpOut, 'utf-8');
      expect(written).toContain('## 📊 Summary');
    } finally {
      rmSync(tmpOut, { force: true });
    }
  });

  it('should accept --output (long form) -o alias', () => {
    const tmpOut = resolve(
      tmpdir(),
      `turborepo-summary-out-long-${Date.now()}.md`,
    );
    try {
      execSync(`node ${cliPath} ${summaryPath} --output ${tmpOut}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      const written = readFileSync(tmpOut, 'utf-8');
      expect(written).toContain('## 📊 Summary');
    } finally {
      rmSync(tmpOut, { force: true });
    }
  });

  it('should display error for invalid JSON file', () => {
    const invalidJsonPath = resolve(process.cwd(), 'tests/invalid.json');

    try {
      execSync(`node ${cliPath} ${invalidJsonPath}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      fail('Expected command to exit non-zero for invalid JSON');
    } catch (error) {
      const execError = error as ExecException;
      expect(execError.stderr?.toString()).toContain('Unable to parse');
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
     "Usage: turborepo-summary [options] [file]

     Generate a human-readable summary report from Turborepo run summary JSON output

     Arguments:
       file                 Path to the Turbo run summary JSON file, "-" for stdin,
                            or omit to use the newest .turbo/runs/*.json

     Options:
       -V, --version        output the version number
       -o, --output <path>  Write the markdown report to a file instead of stdout
       -h, --help           display help for command
     "
    `);
  });

  it('should print a helpful message for dry-run summaries', () => {
    const dryRunPath = resolve(process.cwd(), 'tests/dry-run.json');

    try {
      execSync(`node ${cliPath} ${dryRunPath}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      fail('Expected command to exit non-zero for a dry-run summary');
    } catch (error) {
      const execError = error as ExecException;
      expect(execError.stderr?.toString()).toContain('dry-run');
    }
  });
});
