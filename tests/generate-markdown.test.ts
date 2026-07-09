import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { generateMarkdown, type TurboRunData } from '../src/index.js';

describe('generateMarkdown', () => {
  const summaryJsonPath = resolve(process.cwd(), 'tests/summary.json');

  it('generates a markdown report from turbo summary JSON', () => {
    const data = JSON.parse(readFileSync(summaryJsonPath, 'utf-8'));
    const output = generateMarkdown(data);

    expect(output).toMatchInlineSnapshot(`
     "# 🔍 Turbo Run Report

     **Command:** \`turbo run check-types\`
     **Turbo:** 2.5.8 · **Env:** strict · **Packages:** 5

     ## 📊 Summary

     | Metric | Value |
     |--------|-------|
     | **Total Duration** | 83ms |
     | **Tasks** | 3 |
     | **Tasks OK** | ✓ 3 |
     | **Cached** | 🎯 3 |
     | **Executed** | ▶ 0 |
     | **Failed** | ✗ 0 |
     | **Cache Hit Rate** | 100% (3/3) |
     | **Time Saved by Cache** | 0ms |
     | **Cache Sources** | 🖥️ 3 local · ☁️ 0 remote |

     🚀 **>>> FULL TURBO** — every task was a cache hit!

     ## 📈 Execution Timeline

     \`\`\`mermaid
     gantt
         title Turbo Execution Timeline
         dateFormat x
         axisFormat %M:%S.%L
         section Tasks
         @repo/ui#35;check-types 12ms cached ✓ : 57, 69
         web#35;check-types 13ms cached ✓ : 70, 83
         docs#35;check-types 12ms cached ✓ : 71, 83
     \`\`\`

     ## 🔗 Task Dependencies

     \`\`\`mermaid
     graph TD
         T0["@repo/ui#35;check-types<br/>12ms · 🎯 Hit · ✓"]:::hit
         T1["docs#35;check-types<br/>12ms · 🎯 Hit · ✓"]:::hit
         T2["web#35;check-types<br/>13ms · 🎯 Hit · ✓"]:::hit
         T0 --> T1
         T0 --> T2

         classDef hit fill:#d4edda,stroke:#28a745
         classDef miss fill:#cce5ff,stroke:#007bff
         classDef fail fill:#f8d7da,stroke:#dc3545
         classDef skip fill:#e9ecef,stroke:#6c757d
     \`\`\`

     ## 📋 Detailed Results

     ✅ All tasks were full cache hits — nothing to investigate.

     ---

     _Run completed at Oct 22, 2025 3:22 PM UTC_"
    `);
  });

  it('renders tasks without execution as "Not run" instead of crashing', () => {
    const data = {
      execution: { command: 'turbo run build' },
      tasks: [
        { taskId: 'web#build', cache: { status: 'MISS' } },
        {
          taskId: 'docs#build',
          cache: { status: 'HIT' },
          execution: { startTime: 1000, endTime: 1500, exitCode: 0 },
        },
      ],
    } as unknown as TurboRunData;

    const markdown = generateMarkdown(data);

    expect(markdown).toContain('web#build');
    expect(markdown).toContain('Not run');
  });

  it('handles an empty tasks array explicitly instead of a garbage report', () => {
    const data = {
      execution: { command: 'turbo run build --filter=nothing' },
      tasks: [],
    } as unknown as TurboRunData;

    const markdown = generateMarkdown(data);

    expect(markdown).toContain('No tasks');
    expect(markdown).not.toContain('Infinity');
    expect(markdown).not.toContain('NaN');
  });

  it('treats null exitCode as interrupted (not failed) and surfaces errors', () => {
    const data = {
      execution: { command: 'turbo run build' },
      tasks: [
        {
          taskId: 'web#build',
          cache: { status: 'MISS' },
          execution: {
            startTime: 1000,
            endTime: 1500,
            exitCode: 1,
            error: 'build failed',
          },
        },
        {
          taskId: 'docs#build',
          cache: { status: 'MISS' },
          execution: { startTime: 1000, endTime: 1200, exitCode: null },
        },
        {
          taskId: 'api#build',
          cache: { status: 'HIT' },
          execution: { startTime: 1000, endTime: 1100, exitCode: 0 },
        },
      ],
    } as unknown as TurboRunData;

    const markdown = generateMarkdown(data);

    // null exitCode is its own state, not counted as failed
    expect(markdown).toContain('Interrupted');
    expect(markdown).toContain('| **Failed** | ✗ 1 |');
    // a failed task surfaces its execution.error
    expect(markdown).toContain('build failed');
  });

  it('escapes Mermaid-breaking characters in task ids', () => {
    const data = {
      execution: { command: 'turbo run build' },
      tasks: [
        {
          taskId: 'web,shared#build',
          cache: { status: 'MISS' },
          execution: { startTime: 1000, endTime: 2000, exitCode: 0 },
        },
      ],
    } as unknown as TurboRunData;

    const markdown = generateMarkdown(data);

    // a comma in the name is escaped (a raw comma breaks gantt parsing)
    expect(markdown).toContain('#44;');
    // hashes are escaped too
    expect(markdown).toContain('#35;');
    // emitted entities must not be re-escaped
    expect(markdown).not.toContain('#35;44;');
    expect(markdown).not.toContain('#35;35;');
  });

  it('surfaces cache time saved and local/remote hit sources', () => {
    const data = {
      execution: { command: 'turbo run build', attempted: 3, cached: 2 },
      tasks: [
        {
          taskId: 'web#build',
          cache: { status: 'HIT', source: 'LOCAL', timeSaved: 5000 },
          execution: { startTime: 1000, endTime: 1100, exitCode: 0 },
        },
        {
          taskId: 'docs#build',
          cache: { status: 'HIT', source: 'REMOTE', timeSaved: 8000 },
          execution: { startTime: 1000, endTime: 1050, exitCode: 0 },
        },
        {
          taskId: 'api#build',
          cache: { status: 'MISS' },
          execution: { startTime: 1000, endTime: 3000, exitCode: 0 },
        },
      ],
    } as unknown as TurboRunData;

    const markdown = generateMarkdown(data);

    expect(markdown).toContain('Time Saved by Cache');
    expect(markdown).toContain('| **Time Saved by Cache** | 13s |');
    expect(markdown).toContain('local');
    expect(markdown).toContain('remote');
  });

  it('humanizes durations of a second or more', () => {
    const data = {
      execution: { command: 'turbo run build', startTime: 0, endTime: 754123 },
      tasks: [
        {
          taskId: 'web#build',
          cache: { status: 'MISS' },
          execution: { startTime: 0, endTime: 754123, exitCode: 0 },
        },
      ],
    } as unknown as TurboRunData;

    const markdown = generateMarkdown(data);

    expect(markdown).toContain('12m 34s');
  });

  it('normalizes gantt timestamps relative to run start', () => {
    const data = {
      execution: { command: 'turbo run build', startTime: 1000 },
      tasks: [
        {
          taskId: 'web#build',
          cache: { status: 'MISS' },
          execution: { startTime: 1050, endTime: 1100, exitCode: 0 },
        },
      ],
    } as unknown as TurboRunData;

    const markdown = generateMarkdown(data);

    // offsets relative to run start (1000), not raw epoch timestamps
    expect(markdown).toContain(': 50, 100');
    expect(markdown).not.toContain(': 1050, 1100');
  });

  it('includes exit code and log file for failed tasks', () => {
    const data = {
      execution: { command: 'turbo run build' },
      tasks: [
        {
          taskId: 'web#build',
          logFile: 'apps/web/.turbo/turbo-build.log',
          cache: { status: 'MISS' },
          execution: {
            startTime: 1000,
            endTime: 2000,
            exitCode: 1,
            error: 'oops',
          },
        },
      ],
    } as unknown as TurboRunData;

    const markdown = generateMarkdown(data);

    expect(markdown).toContain('exit 1');
    expect(markdown).toContain('turbo-build.log');
  });

  it('draws dependency edges in the DAG between linked tasks', () => {
    const data = {
      execution: { command: 'turbo run build' },
      tasks: [
        {
          taskId: '@repo/ui#build',
          dependencies: ['@repo/utils#build'],
          cache: { status: 'MISS' },
          execution: { startTime: 1000, endTime: 2000, exitCode: 0 },
        },
        {
          taskId: 'web#build',
          dependencies: ['@repo/ui#build'],
          cache: { status: 'MISS' },
          execution: { startTime: 2000, endTime: 5000, exitCode: 0 },
        },
        {
          taskId: '@repo/utils#build',
          cache: { status: 'HIT' },
          execution: { startTime: 0, endTime: 100, exitCode: 0 },
        },
      ],
    } as unknown as TurboRunData;

    const markdown = generateMarkdown(data);

    // Edges should be drawn: @repo/utils#build --> @repo/ui#build --> web#build
    const dagSection = markdown.split('## 🔗 Task Dependencies')[1];
    expect(dagSection).toContain('T2 --> T0');
    expect(dagSection).toContain('T0 --> T1');
    // No edge to non-existent tasks
    expect(dagSection).not.toContain('T3');
  });

  it('skips dependency edges for tasks not in the run', () => {
    const data = {
      execution: { command: 'turbo run build --filter=web' },
      tasks: [
        {
          taskId: 'web#build',
          dependencies: ['@repo/ui#build', '@repo/utils#build'],
          cache: { status: 'MISS' },
          execution: { startTime: 1000, endTime: 3000, exitCode: 0 },
        },
      ],
    } as unknown as TurboRunData;

    const markdown = generateMarkdown(data);

    const dagSection = markdown.split('## 🔗 Task Dependencies')[1];
    // Only one task, no edges should be drawn
    expect(dagSection).not.toContain('-->');
  });

  it('hides clean cache hits from the detailed table and shows a note', () => {
    const data = {
      execution: { command: 'turbo run build' },
      tasks: [
        {
          taskId: 'web#build',
          cache: { status: 'MISS' },
          execution: { startTime: 1000, endTime: 3000, exitCode: 0 },
        },
        {
          taskId: 'docs#build',
          cache: { status: 'HIT', source: 'LOCAL', timeSaved: 5000 },
          execution: { startTime: 1000, endTime: 1100, exitCode: 0 },
        },
        {
          taskId: 'api#build',
          cache: { status: 'HIT', source: 'REMOTE', timeSaved: 3000 },
          execution: { startTime: 1000, endTime: 1050, exitCode: 0 },
        },
      ],
    } as unknown as TurboRunData;

    const markdown = generateMarkdown(data);

    const resultsSection = markdown.split('## 📋 Detailed Results')[1];

    // The MISS task should be in the table
    expect(resultsSection).toContain('web#build');
    // Clean HIT tasks should NOT be in the table rows
    expect(resultsSection).not.toContain('| `docs#build`');
    expect(resultsSection).not.toContain('| `api#build`');
    // Note about hidden tasks
    expect(resultsSection).toContain(
      '2 tasks were full cache hits and are not shown.',
    );
  });

  it('shows "nothing to investigate" when all tasks are clean cache hits', () => {
    const data = {
      execution: { command: 'turbo run build' },
      tasks: [
        {
          taskId: 'web#build',
          cache: { status: 'HIT', source: 'LOCAL', timeSaved: 5000 },
          execution: { startTime: 1000, endTime: 1100, exitCode: 0 },
        },
        {
          taskId: 'docs#build',
          cache: { status: 'HIT', source: 'LOCAL', timeSaved: 3000 },
          execution: { startTime: 1000, endTime: 1050, exitCode: 0 },
        },
      ],
    } as unknown as TurboRunData;

    const markdown = generateMarkdown(data);

    const resultsSection = markdown.split('## 📋 Detailed Results')[1];

    expect(resultsSection).toContain(
      'All tasks were full cache hits — nothing to investigate.',
    );
    // Should NOT show the "not shown" note (redundant with the above)
    expect(resultsSection).not.toContain('not shown');
  });

  it('color-codes DAG nodes by cache status and execution result', () => {
    const data = {
      execution: { command: 'turbo run build' },
      tasks: [
        {
          taskId: 'hit-task#build',
          cache: { status: 'HIT' },
          execution: { startTime: 0, endTime: 100, exitCode: 0 },
        },
        {
          taskId: 'miss-task#build',
          cache: { status: 'MISS' },
          execution: { startTime: 0, endTime: 200, exitCode: 0 },
        },
        {
          taskId: 'fail-task#build',
          cache: { status: 'MISS' },
          execution: { startTime: 0, endTime: 300, exitCode: 1 },
        },
        {
          taskId: 'skip-task#build',
          cache: { status: 'MISS' },
        },
      ],
    } as unknown as TurboRunData;

    const markdown = generateMarkdown(data);

    const dagSection = markdown.split('## 🔗 Task Dependencies')[1];

    expect(dagSection).toContain(':::hit');
    expect(dagSection).toContain(':::miss');
    expect(dagSection).toContain(':::fail');
    expect(dagSection).toContain(':::skip');
  });
});
