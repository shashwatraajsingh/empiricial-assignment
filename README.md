# Playwright Test Impact Analyzer

A powerful CLI tool that analyzes Git commits to determine which Playwright tests are impacted by code changes. Run only the tests that matter, saving time and resources in your CI/CD pipeline.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage Guide](#usage-guide)
  - [Basic Analysis](#basic-analysis)
  - [Comparing Two Commits](#comparing-two-commits)
  - [Running Only Impacted Tests](#running-only-impacted-tests)
- [Output Formats](#output-formats)
  - [Table Format](#table-format)
  - [JSON Format](#json-format)
  - [Runnable Format](#runnable-format)
- [How It Works](#how-it-works)
  - [Architecture Overview](#architecture-overview)
  - [Impact Detection Algorithm](#impact-detection-algorithm)
  - [Direct vs Indirect Impact](#direct-vs-indirect-impact)
- [Performance Benefits](#performance-benefits)
- [CLI Reference](#cli-reference)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **🔍 Git Integration**: Analyzes all files changed between any two commits, branches, or tags
- **🎯 Direct Test Detection**: Identifies tests that were added, removed, or modified in `.spec.ts` files
- **🔗 Indirect Impact Analysis**: Detects tests impacted by changes in shared utilities, fixtures, or helper files
- **📊 Multiple Output Formats**: Human-readable table, machine-parseable JSON, and runnable command output
- **⚡ Selective Test Execution**: Generates ready-to-use Playwright commands for running only impacted tests
- **🧪 Test vs Suite Detection**: Distinguishes between individual tests (🧪) and test suites/describe blocks (📦)

---

## Installation

### Prerequisites

- Node.js 18+ 
- Git installed and accessible in PATH
- A Playwright test repository

### Setup

```bash
# Clone or navigate to the project
cd /path/to/empirical

# Install dependencies
npm install

# Build the project
npm run build

# Verify installation
node dist/cli.js --help
```

---

## Quick Start

```bash
# Analyze changes between the last two commits
node dist/cli.js analyze --base HEAD~1 --head HEAD --repo ./flash-tests

# Get runnable output for CI/CD
node dist/cli.js analyze --base main --head feature-branch --repo ./flash-tests --format runnable
```

---

## Usage Guide

### Basic Analysis

Analyze which tests are impacted by changes between two commits:

```bash
node dist/cli.js analyze \
  --base <base-commit> \
  --head <head-commit> \
  --repo <path-to-test-repo>
```

**Example:**
```bash
node dist/cli.js analyze --base abc123 --head def456 --repo ./flash-tests
```

### Comparing Two Commits

You can compare any two Git references (commit hashes, branch names, tags):

```bash
# Compare two commit hashes
node dist/cli.js analyze --base 3fd7bab --head 53a703f --repo ./flash-tests

# Compare a branch to main
node dist/cli.js analyze --base main --head feature/new-tests --repo ./flash-tests

# Compare last N commits
node dist/cli.js analyze --base HEAD~5 --head HEAD --repo ./flash-tests

# Compare two tags
node dist/cli.js analyze --base v1.0.0 --head v1.1.0 --repo ./flash-tests
```

### Running Only Impacted Tests

After analyzing, use the provided commands to run only impacted tests:

```bash
# Step 1: Analyze and get runnable format
node dist/cli.js analyze --base HEAD~1 --head HEAD --repo ./flash-tests --format runnable

# Step 2: The output will show commands like:
#   npx playwright test tests/sessions.spec.ts tests/test-runs.spec.ts

# Step 3: Navigate to test repo and run
cd flash-tests
npx playwright test tests/sessions.spec.ts tests/test-runs.spec.ts
```

#### Using JSON Output for CI/CD

```bash
# Generate JSON output to a file
node dist/cli.js analyze --base HEAD~1 --head HEAD --repo ./flash-tests --format runnable --output impacted.json

# Parse and run in CI
IMPACTED_FILES=$(jq -r '.fileList | join(" ")' impacted.json)
cd flash-tests && npx playwright test $IMPACTED_FILES
```

---

## Output Formats

### Table Format

Default human-readable format for quick review:

```bash
node dist/cli.js analyze --base HEAD~1 --head HEAD --repo ./flash-tests --format table
```

**Output:**
```
================================================================================
PLAYWRIGHT TEST IMPACT ANALYSIS
================================================================================

Commits:
  Base: 3fd7bab
  Head: 53a703f

Summary:
  Total files changed: 1
  Test files changed: 1
  Tests added: 0
  Tests removed: 0
  Tests modified: 1

Changed Files:
  [TEST] modified  tests/test-runs.spec.ts

Directly Impacted Tests:

  tests/test-runs.spec.ts:
    ~ [TEST] Group by test:42

================================================================================
```

### JSON Format

Machine-parseable format for integration with other tools:

```bash
node dist/cli.js analyze --base HEAD~1 --head HEAD --repo ./flash-tests --format json
```

**Output:**
```json
{
  "baseCommit": "3fd7bab",
  "headCommit": "53a703f",
  "changedFiles": [
    {
      "filePath": "tests/test-runs.spec.ts",
      "changeType": "modified",
      "isTestFile": true,
      "testChanges": [...]
    }
  ],
  "directlyImpactedTests": [...],
  "indirectlyImpactedTests": [...],
  "summary": {
    "totalFilesChanged": 1,
    "testFilesChanged": 1,
    "testsAdded": 0,
    "testsRemoved": 0,
    "testsModified": 1,
    "testsIndirectlyImpacted": 0
  }
}
```

### Runnable Format

**Optimized for CI/CD pipelines** - provides ready-to-execute Playwright commands:

```bash
node dist/cli.js analyze --base HEAD~1 --head HEAD --repo ./flash-tests --format runnable
```

**Output:**
```
================================================================================
IMPACTED TESTS - RUNNABLE FORMAT
================================================================================

Summary:
  Total impacted tests: 3
  ├─ Directly impacted: 2
  └─ Indirectly impacted: 1
  Tests added: 1
  Tests modified: 2
  Tests removed: 0

Impacted Test Files:
  tests/sessions.spec.ts
  tests/test-runs.spec.ts

Impacted Tests List:
  Format: [impact] [type] file:line - "test name"

  +ADD [TEST] tests/sessions.spec.ts:15 - "Filter sessions by user"
  ~MOD [TEST] tests/sessions.spec.ts:42 - "Subscribe to session"
  ~MOD [TEST] tests/test-runs.spec.ts:28 - "Group by selector" [indirect]
       └─ impacted by: tests/utils/helpers.ts

Playwright Commands:

  # Run all impacted test files:
  npx playwright test tests/sessions.spec.ts tests/test-runs.spec.ts

  # Run specific tests by name (grep):
  npx playwright test --grep "Filter sessions by user|Subscribe to session|Group by selector"

  # Run only newly added tests:
  npx playwright test --grep "Filter sessions by user"

  # Run only modified tests:
  npx playwright test --grep "Subscribe to session|Group by selector"

================================================================================
```

#### Saving Runnable Output to File

```bash
node dist/cli.js analyze --base HEAD~1 --head HEAD --repo ./flash-tests --format runnable --output impacted.json
```

**JSON Structure:**
```json
{
  "summary": {
    "totalImpactedTests": 3,
    "directlyImpacted": 2,
    "indirectlyImpacted": 1,
    "testsAdded": 1,
    "testsModified": 2,
    "testsRemoved": 0
  },
  "impactedTests": [
    {
      "filePath": "tests/sessions.spec.ts",
      "testName": "Filter sessions by user",
      "impactType": "added",
      "changeKind": "test",
      "lineNumber": 15,
      "source": "direct"
    }
  ],
  "playwrightCommands": {
    "runAll": "npx playwright test tests/sessions.spec.ts tests/test-runs.spec.ts",
    "runByFile": "npx playwright test tests/sessions.spec.ts tests/test-runs.spec.ts",
    "runByGrep": "npx playwright test --grep \"...\"",
    "runAddedOnly": "npx playwright test --grep \"Filter sessions by user\"",
    "runModifiedOnly": "npx playwright test --grep \"...\""
  },
  "fileList": ["tests/sessions.spec.ts", "tests/test-runs.spec.ts"],
  "grepPattern": "Filter sessions by user|Subscribe to session|Group by selector"
}
```

---

## How It Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Playwright Test Impact Analyzer               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Git Diff    │───▶│  File        │───▶│  Test Pattern    │   │
│  │  Engine      │    │  Classifier  │    │  Extractor       │   │
│  └──────────────┘    └──────────────┘    └──────────────────┘   │
│         │                   │                     │              │
│         ▼                   ▼                     ▼              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Changed     │    │  Test Files  │    │  Test Changes    │   │
│  │  Files List  │    │  Detection   │    │  (add/mod/del)   │   │
│  └──────────────┘    └──────────────┘    └──────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│                     ┌──────────────────┐                        │
│                     │  Import Graph    │                        │
│                     │  Analysis        │                        │
│                     └──────────────────┘                        │
│                              │                                   │
│                              ▼                                   │
│                     ┌──────────────────┐                        │
│                     │  Impact Report   │                        │
│                     │  Generator       │                        │
│                     └──────────────────┘                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Impact Detection Algorithm

1. **Git Diff Analysis**
   - Runs `git diff --name-status` between base and head commits
   - Categorizes files as: added (A), deleted (D), modified (M), renamed (R)

2. **File Classification**
   - Identifies test files using patterns: `*.spec.ts`, `*.test.ts`, `playwright.config.ts`
   - Separates test files from non-test files (utilities, fixtures, helpers)

3. **Direct Impact Detection**
   - For each changed test file:
     - Extracts all `test()` and `test.describe()` blocks from both commits
     - Compares test names and content to detect: added, removed, modified tests

4. **Indirect Impact Detection**
   - For changed non-test files (utilities, fixtures):
     - Scans all test files for import statements
     - Resolves import paths to actual file paths
     - If a test imports a changed file → mark all tests in that file as indirectly impacted

5. **Report Generation**
   - Aggregates all impacts with metadata (file, line number, impact type)
   - Generates executable Playwright commands

### Direct vs Indirect Impact

| Impact Type | Description | Example |
|-------------|-------------|---------|
| **Direct** | Test file itself was modified | Changed `test('login', ...)` in `auth.spec.ts` |
| **Indirect** | Test imports a file that was modified | `auth.spec.ts` imports `utils/auth-helper.ts` which was changed |

**Why Indirect Impact Matters:**
- A bug in `utils/api-client.ts` could break 50 tests that import it
- Running only directly changed tests would miss these failures
- The analyzer tracks import graphs to catch these dependencies

---

## Performance Benefits

### Running Impacted Tests vs All Tests

| Scenario | All Tests | Impacted Only | Time Saved |
|----------|-----------|---------------|------------|
| Small UI fix | 150 tests (15 min) | 3 tests (30 sec) | ~97% |
| Utility change | 150 tests (15 min) | 20 tests (2 min) | ~87% |
| New feature | 150 tests (15 min) | 8 tests (1 min) | ~93% |

### Benefits

1. **⚡ Faster CI/CD Pipelines**
   - Reduce test execution time from minutes to seconds
   - Get faster feedback on pull requests

2. **💰 Cost Savings**
   - Less CI/CD compute time = lower costs
   - Especially impactful with parallel test runners

3. **🎯 Focused Debugging**
   - Know exactly which tests are affected by your changes
   - Faster root cause analysis when tests fail

4. **🔄 Better Developer Experience**
   - Run relevant tests locally before pushing
   - Don't wait for unrelated tests

### When to Run All Tests

While impacted test analysis is powerful, you should still run **all tests** periodically:

- **Nightly builds**: Catch any missed indirect dependencies
- **Pre-release**: Full regression testing before deployment
- **Major refactors**: When import graphs might have changed significantly
- **Flaky test detection**: Identify tests that fail intermittently

---

## CLI Reference

### Global Options

| Option | Description |
|--------|-------------|
| `--help` | Display help information |
| `--version` | Display version number |

### `analyze` Command

Analyze test impact between two Git commits.

```bash
node dist/cli.js analyze [options]
```

| Option | Required | Description | Default |
|--------|----------|-------------|---------|
| `-b, --base <commit>` | Yes | Base commit hash, branch, or tag | - |
| `-h, --head <commit>` | Yes | Head commit hash, branch, or tag | - |
| `-r, --repo <path>` | No | Path to the Git repository | Current directory |
| `-f, --format <format>` | No | Output format: `table`, `json`, `runnable` | `table` |
| `-o, --output <file>` | No | Output file path (JSON/runnable formats only) | - |

---

## Examples

### Example 1: Quick Local Check

```bash
# See what tests are affected by uncommitted changes
git stash
node dist/cli.js analyze --base HEAD --head stash@{0} --repo ./flash-tests
git stash pop
```

### Example 2: CI/CD Integration (GitHub Actions)

```yaml
name: Run Impacted Tests

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for git diff

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Analyze Impacted Tests
        run: |
          cd impact-analyzer
          npm install && npm run build
          node dist/cli.js analyze \
            --base ${{ github.event.pull_request.base.sha }} \
            --head ${{ github.sha }} \
            --repo ../flash-tests \
            --format runnable \
            --output ../impacted.json

      - name: Run Impacted Tests
        run: |
          IMPACTED_FILES=$(jq -r '.fileList | join(" ")' impacted.json)
          if [ -n "$IMPACTED_FILES" ]; then
            cd flash-tests
            npm install
            npx playwright install --with-deps
            npx playwright test $IMPACTED_FILES
          else
            echo "No impacted tests found"
          fi
```

### Example 3: Compare Feature Branch

```bash
# Analyze all changes in a feature branch vs main
node dist/cli.js analyze \
  --base main \
  --head feature/new-login-flow \
  --repo ./flash-tests \
  --format runnable
```

### Example 4: Weekly Regression Analysis

```bash
# See all tests modified in the last week
WEEK_AGO=$(git log -1 --before="1 week ago" --format="%H" --repo ./flash-tests)
node dist/cli.js analyze \
  --base $WEEK_AGO \
  --head HEAD \
  --repo ./flash-tests \
  --format json \
  --output weekly-impact.json
```

---

## Test File Detection

The analyzer recognizes these Playwright test file patterns:

| Pattern | Example |
|---------|---------|
| `*.spec.ts` | `login.spec.ts` |
| `*.spec.js` | `auth.spec.js` |
| `*.test.ts` | `utils.test.ts` |
| `*.test.tsx` | `component.test.tsx` |
| `playwright.config.ts` | `playwright.config.ts` |

## Test Pattern Detection

### Individual Tests
- `test('name', ...)` 
- `test.only('name', ...)`
- `test.skip('name', ...)`

### Test Suites (Describe Blocks)
- `test.describe('name', ...)`
- `test.describe.only('name', ...)`
- `test.describe.skip('name', ...)`

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

---
# Ready-to-Run Commands:

## Run all impacted test files:

```bash
npx playwright test tests/sessions.spec.ts tests/test-runs.spec.ts
```
## Run specific tests by name (grep):
```bash
npx playwright test --grep "Test Name 1|Test Name 2"
```
## Run only newly added tests:
```bash
npx playwright test --grep "New Test Name"
```
## License

MIT License - see [LICENSE](LICENSE) for details.
