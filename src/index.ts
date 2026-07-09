export type TurboTask = {
  taskId: string;
  dependencies?: string[];
  execution?: {
    startTime: number;
    endTime: number;
    exitCode: number | null;
    error?: string;
  };
  cache: {
    status: 'HIT' | 'MISS';
    local?: boolean;
    remote?: boolean;
    source?: 'LOCAL' | 'REMOTE';
    timeSaved?: number;
  };
  logFile?: string;
};

type RanTask = TurboTask & { execution: NonNullable<TurboTask['execution']> };

export type TurboRunData = {
  version: string;
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
  turboVersion?: string;
  envMode?: string;
  packages?: string[];
};

function escapeMermaid(text: string): string {
  // Escape '#' before ':' and ',' so the '#' in the emitted entities
  // (#58;, #44;, #35;) is not itself re-escaped.
  return text
    .replaceAll('#', '#35;')
    .replaceAll(':', '#58;')
    .replaceAll(',', '#44;');
}

function humanizeDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) {
    const s = ms / 1000;
    return `${Number.isInteger(s) ? s : s.toFixed(1)}s`;
  }
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}m ${totalSec % 60}s`;
}

export function generateMarkdown(data: TurboRunData): string {
  const { tasks, execution, turboVersion, envMode, packages } = data;

  if (tasks.length === 0) {
    return [
      '# 🔍 Turbo Run Report',
      '',
      `**Command:** \`${execution.command || 'unknown'}\``,
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
  const totalTimeSaved = tasks.reduce(
    (sum, t) => sum + (t.cache.timeSaved ?? 0),
    0,
  );
  const localHits = tasks.filter(
    (t) => t.cache.status === 'HIT' && t.cache.source === 'LOCAL',
  ).length;
  const remoteHits = tasks.filter(
    (t) => t.cache.status === 'HIT' && t.cache.source === 'REMOTE',
  ).length;

  // Run-level metrics (preferred) with task-derived fallbacks. Turbo counts
  // cached tasks under `cached`, not `success`; total duration is wall clock.
  const runDuration =
    (execution.endTime ?? latestEnd) - (execution.startTime ?? baseTime);
  const attempted = execution.attempted ?? tasks.length;
  const cached = execution.cached ?? cacheHitCount;
  const failed = execution.failed ?? failedCount;
  const executed = Math.max(0, attempted - cached);
  const tasksOk = Math.max(0, attempted - failed);

  const command = execution.command || 'unknown';

  const lines: string[] = [];
  lines.push('# 🔍 Turbo Run Report');
  lines.push('');
  lines.push(`**Command:** \`${command}\``);
  const metaParts: string[] = [];
  if (turboVersion) metaParts.push(`**Turbo:** ${turboVersion}`);
  if (envMode) metaParts.push(`**Env:** ${envMode}`);
  if (packages?.length) metaParts.push(`**Packages:** ${packages.length}`);
  if (metaParts.length > 0) {
    lines.push(`${metaParts.join(' · ')}`);
  }
  lines.push('');
  lines.push('## 📊 Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| **Total Duration** | ${humanizeDuration(runDuration)} |`);
  lines.push(`| **Tasks** | ${attempted} |`);
  lines.push(`| **Tasks OK** | ✓ ${tasksOk} |`);
  lines.push(`| **Cached** | 🎯 ${cached} |`);
  lines.push(`| **Executed** | ▶ ${executed} |`);
  lines.push(`| **Failed** | ✗ ${failed} |`);
  const hitRate = attempted > 0 ? Math.round((cached / attempted) * 100) : 0;
  lines.push(`| **Cache Hit Rate** | ${hitRate}% (${cached}/${attempted}) |`);
  lines.push(
    `| **Time Saved by Cache** | ${humanizeDuration(totalTimeSaved)} |`,
  );
  if (cacheHitCount > 0) {
    lines.push(
      `| **Cache Sources** | 🖥️ ${localHits} local · ☁️ ${remoteHits} remote |`,
    );
  }
  lines.push('');
  if (attempted > 0 && cached === attempted) {
    lines.push('🚀 **>>> FULL TURBO** — every task was a cache hit!');
    lines.push('');
  }
  lines.push('## 📈 Execution Timeline');
  lines.push('');
  lines.push('```mermaid');
  lines.push('gantt');
  lines.push('    title Turbo Execution Timeline');
  lines.push('    dateFormat x');
  lines.push('    axisFormat %M:%S.%L');
  lines.push('    section Tasks');

  // Generate Gantt chart entries for executed tasks (sorted by start time)
  const tasksByStartTime = [...ranTasks].sort(
    (a, b) => a.execution.startTime - b.execution.startTime,
  );
  const ganttBase = execution.startTime ?? baseTime;

  for (const task of tasksByStartTime) {
    const { taskId, execution, cache } = task;
    const duration = execution.endTime - execution.startTime;
    const statusIcon =
      execution.exitCode === 0 ? '✓' : execution.exitCode === null ? '⊘' : '✗';
    const cacheIcon = cache.status === 'HIT' ? 'cached' : 'miss';
    const escapedTaskId = escapeMermaid(taskId);
    const safeName = `${escapedTaskId} ${humanizeDuration(duration)} ${cacheIcon} ${statusIcon}`;

    lines.push(
      `    ${safeName} : ${execution.startTime - ganttBase}, ${execution.endTime - ganttBase}`,
    );
  }

  lines.push('```');
  lines.push('');

  // ── Dependency DAG ──────────────────────────────────────────────
  // Shows task relationships and cache patterns as a colored graph.
  // Edges are drawn only between tasks present in the current run.
  lines.push('## 🔗 Task Dependencies');
  lines.push('');
  lines.push('```mermaid');
  lines.push('graph TD');

  const taskIdToNodeId = new Map<string, string>();
  for (const [i, task] of tasks.entries()) {
    taskIdToNodeId.set(task.taskId, `T${i}`);
  }

  for (const task of tasks) {
    const nodeId = taskIdToNodeId.get(task.taskId)!;
    const escapedTaskId = escapeMermaid(task.taskId);
    const cacheText = task.cache.status === 'HIT' ? '🎯 Hit' : '⚠️ Miss';
    const duration = task.execution
      ? humanizeDuration(task.execution.endTime - task.execution.startTime)
      : '—';

    let statusIcon: string;
    let className: string;
    if (!task.execution) {
      statusIcon = '⏭';
      className = 'skip';
    } else if (task.execution.exitCode === 0) {
      statusIcon = '✓';
      className = task.cache.status === 'HIT' ? 'hit' : 'miss';
    } else {
      statusIcon = task.execution.exitCode === null ? '⊘' : '✗';
      className = 'fail';
    }

    lines.push(
      `    ${nodeId}["${escapedTaskId}<br/>${duration} · ${cacheText} · ${statusIcon}"]:::${className}`,
    );
  }

  for (const task of tasks) {
    if (!task.dependencies) continue;
    const currentNodeId = taskIdToNodeId.get(task.taskId)!;
    for (const dep of task.dependencies) {
      const depNodeId = taskIdToNodeId.get(dep);
      if (depNodeId) {
        lines.push(`    ${depNodeId} --> ${currentNodeId}`);
      }
    }
  }

  lines.push('');
  lines.push('    classDef hit fill:#d4edda,stroke:#28a745');
  lines.push('    classDef miss fill:#cce5ff,stroke:#007bff');
  lines.push('    classDef fail fill:#f8d7da,stroke:#dc3545');
  lines.push('    classDef skip fill:#e9ecef,stroke:#6c757d');
  lines.push('```');
  lines.push('');

  // ── Detailed Results (slimmed) ──────────────────────────────────
  // Clean cache hits are hidden to reduce noise; only tasks that need
  // investigation (misses, failures, not-run) are shown in the table.
  lines.push('## 📋 Detailed Results');
  lines.push('');

  const orderedTasks: TurboTask[] = [
    ...tasksByStartTime,
    ...tasks.filter((t) => !t.execution),
  ];

  const isCleanHit = (task: TurboTask): boolean =>
    task.execution != null &&
    task.execution.exitCode === 0 &&
    task.cache.status === 'HIT';

  const interestingTasks = orderedTasks.filter((t) => !isCleanHit(t));
  const hiddenCount = orderedTasks.length - interestingTasks.length;

  if (interestingTasks.length === 0) {
    lines.push('✅ All tasks were full cache hits — nothing to investigate.');
  } else {
    lines.push('| Task | Duration | Cache | Status |');
    lines.push('|------|----------:|-------|--------|');

    for (const task of interestingTasks) {
      const { taskId, cache, logFile } = task;
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
        status = `❌ Failed (exit ${task.execution.exitCode})`;
        if (task.execution.error) {
          const error = task.execution.error
            .replaceAll('|', '\\|')
            .replaceAll(/\r?\n/g, ' ');
          status += ` — ${error}`;
        }
        if (logFile) {
          status += ` · 📄 \`${logFile}\``;
        }
      }

      lines.push(
        `| \`${taskId}\` | ${humanizeDuration(duration)} | ${cacheStatus} | ${status} |`,
      );
    }
  }

  if (hiddenCount > 0 && interestingTasks.length > 0) {
    lines.push('');
    const taskWord = hiddenCount === 1 ? 'task was' : 'tasks were';
    lines.push(
      `📋 ${hiddenCount} ${taskWord} full cache hits and are not shown.`,
    );
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  const completedAt = execution.endTime
    ? new Date(execution.endTime)
    : new Date();
  const dateStr = completedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const timeStr = completedAt.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
  lines.push(`_Run completed at ${dateStr} ${timeStr} UTC_`);

  return lines.join('\n');
}
