import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { generateMarkdown, type TurboRunData } from '../src/index.js';

describe('generateMarkdown', () => {
  const summaryJsonPath = resolve(process.cwd(), 'tests/summary.json');

  it('generates a markdown report from turbo summary JSON', () => {
    const data = JSON.parse(readFileSync(summaryJsonPath, 'utf-8'));
    const output = generateMarkdown(data);

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

     _Generated on [timestamp]_"
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
});
