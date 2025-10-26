# Turborepo Summary

<img height="100" src="" alt="library's logo" align="right">

[![Version](https://badge.fury.io/js/turborepo-summary.svg)](https://www.npmjs.org/package/turborepo-summary)
[![Monthly Downloads](https://img.shields.io/npm/dm/turborepo-summary)](https://www.npmjs.org/package/turborepo-summary)
[![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/charpeni/turborepo-summary/blob/main/LICENSE)

Generate human-readable markdown reports from [Turborepo](https://turborepo.com/) run summary JSON output.

<hr />

Turborepo offers a flag ([`--summarize`](https://turborepo.com/docs/reference/run#--summarize)) that generates a JSON file in `.turbo/runs` containing metadata about the run, including:

- Affected packages
- Executed tasks (including their timings and hashes)
- All the files included in the cached artifacts

But it produces a JSON artifact that is not very human-readable, that's where this tool comes in.

This tool is particularly useful for:

- **CI/CD Reporting** — Generate markdown reports in GitHub Actions or other CI environments to visualize Turborepo performance
- **Performance Analysis** — Identify slow tasks and evaluate cache effectiveness
- **Team Communication** — Share human-readable build summaries with your team
- **Documentation** — Archive build statistics and track performance over time

## Installation

```bash
npx turborepo-summary .turbo/runs/[hash].json
```

## Usage

> [!TIP]
> If you are looking to generate a markdown report from Turborepo running on GitHub Actions, check this GitHub Action that does it for you: [turborepo-summary-action](https://github.com/charpeni/turborepo-summary-action)

First, generate a Turborepo run summary JSON file by running any turbo command with the `--summarize` flag:

```bash
turbo run build --summarize
```

This creates a JSON file (typically in `.turbo/runs/`) containing execution data for your tasks.

Then, generate a markdown report from that JSON file:

```bash
npx turborepo-summary .turbo/runs/[hash].json
```

> [!TIP]
> Running this CLI generates a markdown report, then you can view it at your convenience:
>
> Pipe it to either your IDE (e.g., VS Code) to view it:
>
> ```bash
> npx turborepo-summary .turbo/runs/[hash].json | code -
> ```
>
> Use a markdown terminal viewer tool, like [`glow`](https://github.com/charmbracelet/glow):
>
> ```bash
> npx turborepo-summary .turbo/runs/[hash].json | glow -
> ```

### CLI Options

```
Usage: turborepo-summary [options] <file>

Arguments:
  file           Path to the Turbo run summary JSON file

Options:
  -V, --version  output the version number
  -h, --help     display help for command
```

## Output

The tool generates a comprehensive markdown report with three main sections:

### Summary Metrics

Shows key statistics including:

- Total execution duration
- Number of tasks executed
- Success/failure counts
- Cache hit/miss statistics

### Execution Timeline

Provides a Mermaid Gantt chart visualizing task execution over time, showing:

- When each task started and ended
- Task duration
- Cache status
- Success/failure indicators

### Detailed Results

A table with per-task information including task ID, duration, cache status, and execution status.

## License

turborepo-summary is [MIT licensed](LICENSE).
