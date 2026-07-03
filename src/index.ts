export type TurboTask = {
  taskId: string;
  execution?: {
    startTime: number;
    endTime: number;
    exitCode: number | null;
    error?: string;
  };
  cache: {
    status: 'HIT' | 'MISS';
  };
};

type RanTask = TurboTask & { execution: NonNullable<TurboTask['execution']> };

export type TurboRunData = {
  tasks: TurboTask[];
  execution: {
    command: string;
    repoPath?: string;
    startTime?: number;
    endTime?: number;
    success?: number;
    failed?: number;
    cached?: number;
    attempted?: number;
    exitCode?: number | null;
  };
};

function escapeMermaid(text: string): string {
  // Escape '#' before ':' and ',' so the '#' in the emitted entities
  // (#58;, #44;, #35;) is not itself re-escaped.
  return text
    .replaceAll('#', '#35;')
    .replaceAll(':', '#58;')
    .replaceAll(',', '#44;');
}

export function generateMarkdown(data: TurboRunData): string {
  const { tasks, execution } = data;

  if (tasks.length === 0) {
    return [
      '# 🔍 Turbo Run Report',
      '',
      `> **Command:** \`${execution.command || 'unknown'}\``,
      '',
      '_No tasks found in this summary (this can happen with `--filter` matching nothing)._',
    ].join('\n');
  }

  const isRan = (task: TurboTask): task is RanTask => task.execution != null;
  const ranTasks = tasks.filter(isRan);

  // Task-derived timing (fallback and per-task detail)
  const startTimes = ranTasks.map((t) => t.execution.startTime);
  const endTimes = ranTasks.map((t) => t.execution.endTime);
  const baseTime = startTimes.length ? Math.min(...startTimes) : 0;
  const latestEnd = endTimes.length ? Math.max(...endTimes) : 0;

  const failedCount = ranTasks.filter(
    (t) => t.execution.exitCode !== null && t.execution.exitCode !== 0,
  ).length;
  const cacheHitCount = tasks.filter((t) => t.cache.status === 'HIT').length;

  // Run-level metrics (preferred) with task-derived fallbacks. Turbo counts
  // cached tasks under `cached`, not `success`; total duration is wall clock.
  const runDuration =
    (execution.endTime ?? latestEnd) - (execution.startTime ?? baseTime);
  const runSec = (runDuration / 1000).toFixed(2);
  const attempted = execution.attempted ?? tasks.length;
  const cached = execution.cached ?? cacheHitCount;
  const failed = execution.failed ?? failedCount;
  const executed = Math.max(0, attempted - cached);
  const tasksOk = Math.max(0, attempted - failed);

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
  lines.push(`| **Total Duration** | ${runSec}s (${runDuration}ms) |`);
  lines.push(`| **Tasks** | ${attempted} |`);
  lines.push(`| **Tasks OK** | ✓ ${tasksOk} |`);
  lines.push(`| **Cached** | 🎯 ${cached} |`);
  lines.push(`| **Executed** | ▶ ${executed} |`);
  lines.push(`| **Failed** | ✗ ${failed} |`);
  lines.push('');
  lines.push('## 📈 Execution Timeline');
  lines.push('');
  lines.push('```mermaid');
  lines.push('gantt');
  lines.push('    title Turbo Execution Timeline');
  lines.push('    dateFormat x');
  lines.push('    axisFormat %S.%L');
  lines.push('    section Tasks');

  // Generate Gantt chart entries for executed tasks (sorted by start time)
  const tasksByStartTime = [...ranTasks].sort(
    (a, b) => a.execution.startTime - b.execution.startTime,
  );

  for (const task of tasksByStartTime) {
    const { taskId, execution, cache } = task;
    const duration = execution.endTime - execution.startTime;
    const statusIcon =
      execution.exitCode === 0 ? '✓' : execution.exitCode === null ? '⊘' : '✗';
    const cacheIcon = cache.status === 'HIT' ? 'cached' : 'miss';
    const escapedTaskId = escapeMermaid(taskId);
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

  // Detailed table: executed tasks (sorted by start time), then tasks that never ran
  const orderedTasks: TurboTask[] = [
    ...tasksByStartTime,
    ...tasks.filter((t) => !t.execution),
  ];

  for (const task of orderedTasks) {
    const { taskId, cache } = task;
    const cacheStatus = cache.status === 'HIT' ? '🎯 Hit' : '⚠️ Miss';

    if (!task.execution) {
      lines.push(`| \`${taskId}\` | — | ${cacheStatus} | ⏭ Not run |`);
      continue;
    }

    const duration = task.execution.endTime - task.execution.startTime;
    let status: string;
    if (task.execution.exitCode === 0) {
      status = '✅ Success';
    } else if (task.execution.exitCode === null) {
      status = '⊘ Interrupted';
    } else {
      status = '❌ Failed';
      if (task.execution.error) {
        const error = task.execution.error
          .replaceAll('|', '\\|')
          .replaceAll(/\r?\n/g, ' ');
        status += ` — ${error}`;
      }
    }

    lines.push(
      `| \`${taskId}\` | ${duration}ms | ${cacheStatus} | ${status} |`,
    );
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  const completedAt = execution.endTime
    ? new Date(execution.endTime).toISOString()
    : new Date().toISOString();
  lines.push(`_Run completed at ${completedAt}_`);

  return lines.join('\n');
}
