#!/usr/bin/env node

import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Command } from 'commander';

import { generateMarkdown, type TurboRunData } from './index.js';

export { generateMarkdown };
export type { TurboTask, TurboRunData } from './index.js';

function runReport(jsonFile: string): void {
  let data: TurboRunData;

  try {
    const fileContent = readFileSync(jsonFile, 'utf-8');
    data = JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error: Unable to read or parse file ${jsonFile}`);
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

  console.log(generateMarkdown(data));
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
    .argument('<file>', 'Path to the Turbo run summary JSON file')
    .showHelpAfterError('(add --help for additional information)')
    .configureOutput({
      outputError: (str, write) => {
        if (str.includes('missing required argument')) {
          write(
            '\nError: No input file specified.\n\n' +
              'Please provide a path to your Turborepo run summary JSON file.\n\n' +
              'Example:\n' +
              '  $ npx turborepo-summary ./turbo-run.json\n\n' +
              'To generate the JSON file, run your Turborepo command with the --summarize flag:\n' +
              '  $ turbo run build --summarize\n\n',
          );
        } else {
          write(str);
        }
      },
    })
    .action((file: string) => {
      runReport(file);
    });

  program.parse();
}
