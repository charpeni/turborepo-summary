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

     > **Command:** \`turbo run check-types\`
     > **Turbo:** 2.5.8 · **Env:** strict · **Packages:** 5

     ## 📊 Summary

     | Metric | Value |
     |--------|-------|
     | **Total Duration** | 0.08s (83ms) |
     | **Tasks** | 3 |
     | **Tasks OK** | ✓ 3 |
     | **Cached** | 🎯 3 |
     | **Executed** | ▶ 0 |
     | **Failed** | ✗ 0 |
     | **Cache Hit Rate** | 100% (3/3) |
     | **Time Saved by Cache** | 0ms |
     | **Cache Sources** | 🖥️ 3 local · ☁️ 0 remote |

     > 🚀 **>>> FULL TURBO** — every task was a cache hit!

     ## 📈 Execution Timeline

     \`\`\`mermaid
     gantt
         title Turbo Execution Timeline
         dateFormat x
         axisFormat %S.%L
         section Tasks
         @repo/ui#35;check-types 12ms cached ✓ : 1761146561000, 1761146561012
         web#35;check-types 13ms cached ✓ : 1761146561013, 1761146561026
         docs#35;check-types 12ms cached ✓ : 1761146561014, 1761146561026
     \`\`\`

     ## 📋 Detailed Results

     | Task | Duration | Cache | Status |
     |------|----------:|-------|--------|
     | \`@repo/ui#check-types\` | 12ms | 🎯 Hit | ✅ Success |
     | \`web#check-types\` | 13ms | 🎯 Hit | ✅ Success |
     | \`docs#check-types\` | 12ms | 🎯 Hit | ✅ Success |

     ---

     _Run completed at 2025-10-22T15:22:41.026Z_"
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
    expect(markdown).toContain('13000ms');
    expect(markdown).toContain('local');
    expect(markdown).toContain('remote');
  });
});
