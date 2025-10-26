#!/usr/bin/env node

import { readFileSync } from 'node:fs';

import { Command } from 'commander';

type TurboTask = {
  taskId: string;
  execution: {
    startTime: number;
    endTime: number;
    exitCode: number;
  };
  cache: {
    status: 'HIT' | 'MISS';
  };
};

type TurboRunData = {
  tasks: TurboTask[];
  execution: {
    command: string;
    startTime?: number;
    endTime?: number;
  };
};

function generateReport(jsonFile: string) {
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

  // Calculate metrics
  const startTimes = tasks.map((t) => t.execution.startTime);
  const endTimes = tasks.map((t) => t.execution.endTime);
  const baseTime = Math.min(...startTimes);
  const endTime = Math.max(...endTimes);
  const totalDuration = endTime - baseTime;
  const totalSec = (totalDuration / 1000).toFixed(2);

  const successCount = tasks.filter((t) => t.execution.exitCode === 0).length;
  const failedCount = tasks.filter((t) => t.execution.exitCode !== 0).length;
  const totalCount = tasks.length;
  const cacheHitCount = tasks.filter((t) => t.cache.status === 'HIT').length;
  const cacheMissCount = tasks.filter((t) => t.cache.status === 'MISS').length;

  const command = execution.command || 'unknown';

  // Generate markdown output
  console.log('# 🔍 Turbo Run Report');
  console.log('');
  console.log(`> **Command:** \`${command}\``);
  console.log('');
  console.log('## 📊 Summary');
  console.log('');
  console.log('| Metric | Value |');
  console.log('|--------|-------|');
  console.log(`| **Total Duration** | ${totalSec}s (${totalDuration}ms) |`);
  console.log(`| **Tasks Executed** | ${totalCount} |`);
  console.log(`| **Successful** | ✓ ${successCount} |`);
  console.log(`| **Failed** | ✗ ${failedCount} |`);
  console.log(`| **Cache Hits** | 🎯 ${cacheHitCount} |`);
  console.log(`| **Cache Misses** | ⚠️ ${cacheMissCount} |`);
  console.log('');
  console.log('## 📈 Execution Timeline');
  console.log('');
  console.log('```mermaid');
  console.log('gantt');
  console.log('    title Turbo Execution Timeline');
  console.log('    dateFormat x');
  console.log('    axisFormat %S.%L');
  console.log('    section Tasks');

  // Generate Gantt chart entries (sorted by start time)
  const tasksByStartTime = [...tasks].sort(
    (a, b) => a.execution.startTime - b.execution.startTime,
  );

  for (const task of tasksByStartTime) {
    const { taskId, execution, cache } = task;
    const duration = execution.endTime - execution.startTime;
    const statusIcon = execution.exitCode === 0 ? '✓' : '✗';
    const cacheIcon = cache.status === 'HIT' ? 'cached' : 'miss';
    const safeName = `${taskId} ${duration}ms ${cacheIcon} ${statusIcon}`;

    console.log(
      `    ${safeName} : ${execution.startTime}, ${execution.endTime}`,
    );
  }

  console.log('```');
  console.log('');
  console.log('## 📋 Detailed Results');
  console.log('');
  console.log('| Task | Duration | Cache | Status |');
  console.log('|------|----------:|-------|--------|');

  // Generate detailed table in execution order (sorted by start time)
  for (const task of tasksByStartTime) {
    const { taskId, execution, cache } = task;
    const duration = execution.endTime - execution.startTime;
    const status = execution.exitCode === 0 ? '✅ Success' : '❌ Failed';
    const cacheStatus = cache.status === 'HIT' ? '🎯 Hit' : '⚠️ Miss';

    console.log(
      `| \`${taskId}\` | ${duration}ms | ${cacheStatus} | ${status} |`,
    );
  }

  console.log('');
  console.log('---');
  console.log('');
  console.log(`_Generated on ${new Date().toLocaleString('en-US')}_`);
}

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
    generateReport(file);
  });

program.parse();
