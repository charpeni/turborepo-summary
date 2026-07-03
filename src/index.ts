export type TurboTask = {
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

export type TurboRunData = {
  tasks: TurboTask[];
  execution: {
    command: string;
    startTime?: number;
    endTime?: number;
  };
};

export function generateMarkdown(data: TurboRunData): string {
  const { tasks, execution } = data;

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

  const lines: string[] = [];
  lines.push('# 🔍 Turbo Run Report');
  lines.push('');
  lines.push(`> **Command:** \`${command}\``);
  lines.push('');
  lines.push('## 📊 Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| **Total Duration** | ${totalSec}s (${totalDuration}ms) |`);
  lines.push(`| **Tasks Executed** | ${totalCount} |`);
  lines.push(`| **Successful** | ✓ ${successCount} |`);
  lines.push(`| **Failed** | ✗ ${failedCount} |`);
  lines.push(`| **Cache Hits** | 🎯 ${cacheHitCount} |`);
  lines.push(`| **Cache Misses** | ⚠️ ${cacheMissCount} |`);
  lines.push('');
  lines.push('## 📈 Execution Timeline');
  lines.push('');
  lines.push('```mermaid');
  lines.push('gantt');
  lines.push('    title Turbo Execution Timeline');
  lines.push('    dateFormat x');
  lines.push('    axisFormat %S.%L');
  lines.push('    section Tasks');

  // Generate Gantt chart entries (sorted by start time)
  const tasksByStartTime = [...tasks].sort(
    (a, b) => a.execution.startTime - b.execution.startTime,
  );

  for (const task of tasksByStartTime) {
    const { taskId, execution, cache } = task;
    const duration = execution.endTime - execution.startTime;
    const statusIcon = execution.exitCode === 0 ? '✓' : '✗';
    const cacheIcon = cache.status === 'HIT' ? 'cached' : 'miss';
    const escapedTaskId = taskId.replaceAll(':', '#58;');
    const safeName = `${escapedTaskId} ${duration}ms ${cacheIcon} ${statusIcon}`;

    lines.push(
      `    ${safeName} : ${execution.startTime}, ${execution.endTime}`,
    );
  }

  lines.push('```');
  lines.push('');
  lines.push('## 📋 Detailed Results');
  lines.push('');
  lines.push('| Task | Duration | Cache | Status |');
  lines.push('|------|----------:|-------|--------|');

  // Generate detailed table in execution order (sorted by start time)
  for (const task of tasksByStartTime) {
    const { taskId, execution, cache } = task;
    const duration = execution.endTime - execution.startTime;
    const status = execution.exitCode === 0 ? '✅ Success' : '❌ Failed';
    const cacheStatus = cache.status === 'HIT' ? '🎯 Hit' : '⚠️ Miss';

    lines.push(
      `| \`${taskId}\` | ${duration}ms | ${cacheStatus} | ${status} |`,
    );
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`_Generated on ${new Date().toLocaleString('en-US')}_`);

  return lines.join('\n');
}
