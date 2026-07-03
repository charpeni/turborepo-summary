#!/usr/bin/env node

import {
  readFileSync,
  readdirSync,
  statSync,
  realpathSync,
  writeFileSync,
  type Stats,
} from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';

import { generateMarkdown, type TurboRunData } from './index.js';

export { generateMarkdown };
export type { TurboTask, TurboRunData } from './index.js';

const RUNS_DIR = '.turbo/runs';

function readRunData(file: string): TurboRunData {
  let fileContent: string;

  if (file === '-') {
    // Read JSON from stdin (fd 0).
    fileContent = readFileSync(0, 'utf-8');
  } else {
    try {
      fileContent = readFileSync(file, 'utf-8');
    } catch (error) {
      console.error(`Error: Unable to read or parse file ${file}`);
      if (error instanceof Error) {
        console.error(error.message);
      }
      process.exit(1);
    }
  }

  let data: TurboRunData;
  try {
    data = JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error: Unable to parse JSON from ${file}`);
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  const { tasks, execution } = data;

  if (!tasks || !execution) {
    console.error('Error: Invalid Turbo run JSON format');
    process.exit(1);
  }

  // Dry-run summaries (--dry=json) have tasks but none with execution data
  if (tasks.length > 0 && !tasks.some((task) => task.execution)) {
    console.error(
      'Error: This summary has no task execution data — it looks like a dry-run (--dry=json).',
    );
    console.error(
      'turborepo-summary needs a real run. Re-run without --dry, or point it at a file from .turbo/runs/.',
    );
    process.exit(1);
  }

  return data;
}

function resolveDefaultFile(): string {
  const runsDir = resolve(process.cwd(), RUNS_DIR);

  let entries: string[];
  try {
    entries = readdirSync(runsDir);
  } catch {
    console.error(
      `Error: No input file specified and no ${RUNS_DIR}/ directory found in ${process.cwd()}.`,
    );
    console.error(
      'Provide a path to your Turbo run summary JSON file, or run a Turborepo command with --summarize first.',
    );
    console.error('\nExample:\n  $ npx turborepo-summary ./turbo-run.json');
    process.exit(1);
  }

  const jsonFiles = entries
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const fullPath = resolve(runsDir, name);
      let stat: Stats;
      try {
        stat = statSync(fullPath);
      } catch {
        return null;
      }
      return { path: fullPath, mtime: stat.mtimeMs };
    })
    .filter(
      (entry): entry is { path: string; mtime: number } => entry !== null,
    );

  if (jsonFiles.length === 0) {
    console.error(
      `Error: No input file specified and no *.json files found in ${RUNS_DIR}/.`,
    );
    console.error(
      'Provide a path to your Turbo run summary JSON file, or run a Turborepo command with --summarize first.',
    );
    console.error('\nExample:\n  $ npx turborepo-summary ./turbo-run.json');
    process.exit(1);
  }

  jsonFiles.sort((a, b) => b.mtime - a.mtime);
  const newest = jsonFiles[0];
  if (!newest) {
    // Should be unreachable — length === 0 case exits above — but keep TS happy.
    console.error(
      `Error: No input file specified and no usable *.json files found in ${RUNS_DIR}/.`,
    );
    process.exit(1);
  }
  return newest.path;
}

function isMainModule(): boolean {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const packageJsonPath = new URL('../package.json', import.meta.url);
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

  const program = new Command();

  program
    .name('turborepo-summary')
    .description(packageJson.description)
    .version(packageJson.version)
    .argument(
      '[file]',
      'Path to the Turbo run summary JSON file, "-" for stdin, or omit to use the newest .turbo/runs/*.json',
    )
    .option(
      '-o, --output <path>',
      'Write the markdown report to a file instead of stdout',
    )
    .showHelpAfterError('(add --help for additional information)')
    .action((file: string | undefined, options: { output?: string }) => {
      const inputPath = file ?? resolveDefaultFile();
      const data = readRunData(inputPath);

      let markdown: string;
      try {
        markdown = generateMarkdown(data);
      } catch (error) {
        console.error(
          `Error: Failed to render Turbo summary — ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        console.error(
          'Please open an issue at https://github.com/charpeni/turborepo-summary/issues',
        );
        process.exit(1);
      }

      if (options.output) {
        try {
          writeFileSync(options.output, markdown);
        } catch (error) {
          console.error(`Error: Unable to write output to ${options.output}`);
          if (error instanceof Error) {
            console.error(error.message);
          }
          process.exit(1);
        }
      } else {
        process.stdout.write(markdown);
      }
    });

  program.parse();
}
