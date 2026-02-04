#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { PlaywrightTestImpactAnalyzer } from './analyzer.js';
const program = new Command();
program
    .name('playwright-impact-analyzer')
    .description('CLI tool to analyze which Playwright tests are impacted by changes between Git commits')
    .version('1.0.0');
program
    .command('analyze')
    .description('Analyze test impact between two Git commits')
    .requiredOption('-b, --base <commit>', 'Base commit hash or reference')
    .requiredOption('-h, --head <commit>', 'Head commit hash or reference')
    .option('-r, --repo <path>', 'Path to the Git repository', process.cwd())
    .option('-f, --format <format>', 'Output format (json|table|runnable)', 'table')
    .option('-o, --output <file>', 'Output file path (optional)')
    .action(async (options) => {
    try {
        console.log(chalk.blue(`Analyzing impact between ${options.base} and ${options.head}...`));
        const analyzer = new PlaywrightTestImpactAnalyzer(options.repo);
        const result = analyzer.analyze(options.base, options.head);
        if (options.format === 'json') {
            outputJson(result, options.output);
        }
        else if (options.format === 'runnable') {
            outputRunnable(result, options.output);
        }
        else {
            outputTable(result);
        }
    }
    catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
});
program
    .command('list-tests')
    .description('List all Playwright tests in a specific commit')
    .requiredOption('-c, --commit <commit>', 'Commit hash or reference')
    .option('-r, --repo <path>', 'Path to the Git repository', process.cwd())
    .option('-f, --format <format>', 'Output format (json|table)', 'table')
    .action(async (options) => {
    try {
        console.log(chalk.blue(`Listing tests in commit ${options.commit}...`));
        // Implementation for listing tests would go here
        console.log(chalk.yellow('Feature coming soon...'));
    }
    catch (error) {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
});
import { writeFileSync } from 'fs';
function outputJson(result, outputFile) {
    const jsonOutput = JSON.stringify(result, null, 2);
    if (outputFile) {
        writeFileSync(outputFile, jsonOutput);
        console.log(chalk.green(`Results written to ${outputFile}`));
    }
    else {
        console.log(jsonOutput);
    }
}
function generateRunnableOutput(result) {
    const impactedTests = [];
    // Add directly impacted tests
    for (const test of result.directlyImpactedTests) {
        impactedTests.push({
            filePath: test.filePath,
            testName: test.testName,
            impactType: test.type,
            changeKind: test.changeKind,
            lineNumber: test.lineNumber,
            source: 'direct',
        });
    }
    // Add indirectly impacted tests
    for (const test of result.indirectlyImpactedTests) {
        impactedTests.push({
            filePath: test.filePath,
            testName: test.testName,
            impactType: test.type,
            changeKind: test.changeKind,
            lineNumber: test.lineNumber,
            source: 'indirect',
            impactedBy: test.impactedBy,
        });
    }
    // Get unique file paths (excluding removed tests since those files might not exist)
    const runnableTests = impactedTests.filter(t => t.impactType !== 'removed');
    const fileList = [...new Set(runnableTests.map(t => t.filePath))];
    // Generate grep pattern for test names (escape special regex chars)
    const testNames = runnableTests
        .filter(t => t.changeKind === 'test')
        .map(t => escapeRegex(t.testName));
    const grepPattern = testNames.length > 0 ? testNames.join('|') : '';
    // Generate Playwright commands
    const fileArgs = fileList.join(' ');
    const playwrightCommands = {
        runAll: fileList.length > 0
            ? `npx playwright test ${fileArgs}`
            : '# No runnable tests found',
        runByFile: fileList.length > 0
            ? `npx playwright test ${fileArgs}`
            : '# No runnable tests found',
        runByGrep: grepPattern
            ? `npx playwright test --grep "${grepPattern}"`
            : '# No test grep pattern available',
        runAddedOnly: runnableTests.filter(t => t.impactType === 'added').length > 0
            ? `npx playwright test --grep "${runnableTests.filter(t => t.impactType === 'added').map(t => escapeRegex(t.testName)).join('|')}"`
            : '# No added tests',
        runModifiedOnly: runnableTests.filter(t => t.impactType === 'modified').length > 0
            ? `npx playwright test --grep "${runnableTests.filter(t => t.impactType === 'modified').map(t => escapeRegex(t.testName)).join('|')}"`
            : '# No modified tests',
    };
    return {
        summary: {
            totalImpactedTests: impactedTests.length,
            directlyImpacted: result.directlyImpactedTests.length,
            indirectlyImpacted: result.indirectlyImpactedTests.length,
            testsAdded: impactedTests.filter(t => t.impactType === 'added').length,
            testsModified: impactedTests.filter(t => t.impactType === 'modified').length,
            testsRemoved: impactedTests.filter(t => t.impactType === 'removed').length,
        },
        impactedTests,
        playwrightCommands,
        fileList,
        grepPattern,
    };
}
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function outputRunnable(result, outputFile) {
    const runnable = generateRunnableOutput(result);
    if (outputFile) {
        writeFileSync(outputFile, JSON.stringify(runnable, null, 2));
        console.log(chalk.green(`Runnable test list written to ${outputFile}`));
        return;
    }
    // Console output
    console.log('\n' + chalk.bold('='.repeat(80)));
    console.log(chalk.bold('IMPACTED TESTS - RUNNABLE FORMAT'));
    console.log(chalk.bold('='.repeat(80)));
    console.log(`\n${chalk.bold('Summary:')}`);
    console.log(`  Total impacted tests: ${chalk.cyan(runnable.summary.totalImpactedTests)}`);
    console.log(`  ├─ Directly impacted: ${chalk.yellow(runnable.summary.directlyImpacted)}`);
    console.log(`  └─ Indirectly impacted: ${chalk.blue(runnable.summary.indirectlyImpacted)}`);
    console.log(`  Tests added: ${chalk.green(runnable.summary.testsAdded)}`);
    console.log(`  Tests modified: ${chalk.yellow(runnable.summary.testsModified)}`);
    console.log(`  Tests removed: ${chalk.red(runnable.summary.testsRemoved)}`);
    console.log(`\n${chalk.bold('Impacted Test Files:')}`);
    for (const file of runnable.fileList) {
        console.log(`  ${chalk.cyan(file)}`);
    }
    console.log(`\n${chalk.bold('Impacted Tests List:')}`);
    console.log(chalk.gray('  Format: [impact] [type] file:line - "test name"'));
    console.log();
    for (const test of runnable.impactedTests) {
        const impactIcon = test.impactType === 'added' ? chalk.green('+ADD')
            : test.impactType === 'removed' ? chalk.red('-DEL')
                : chalk.yellow('~MOD');
        const typeIcon = test.changeKind === 'describe' ? '[SUITE]' : '[TEST]';
        const sourceTag = test.source === 'indirect' ? chalk.blue(' [indirect]') : '';
        const lineInfo = test.lineNumber ? `:${test.lineNumber}` : '';
        console.log(`  ${impactIcon} ${typeIcon} ${chalk.cyan(test.filePath)}${chalk.gray(lineInfo)} - "${test.testName}"${sourceTag}`);
        if (test.impactedBy) {
            console.log(chalk.gray(`       └─ impacted by: ${test.impactedBy}`));
        }
    }
    console.log(`\n${chalk.bold('Playwright Commands:')}`);
    console.log(`\n  ${chalk.gray('# Run all impacted test files:')}`);
    console.log(`  ${chalk.green(runnable.playwrightCommands.runByFile)}`);
    if (runnable.grepPattern) {
        console.log(`\n  ${chalk.gray('# Run specific tests by name (grep):')}`);
        console.log(`  ${chalk.green(runnable.playwrightCommands.runByGrep)}`);
    }
    if (!runnable.playwrightCommands.runAddedOnly.startsWith('#')) {
        console.log(`\n  ${chalk.gray('# Run only newly added tests:')}`);
        console.log(`  ${chalk.green(runnable.playwrightCommands.runAddedOnly)}`);
    }
    if (!runnable.playwrightCommands.runModifiedOnly.startsWith('#')) {
        console.log(`\n  ${chalk.gray('# Run only modified tests:')}`);
        console.log(`  ${chalk.green(runnable.playwrightCommands.runModifiedOnly)}`);
    }
    console.log('\n' + chalk.bold('='.repeat(80)));
}
function outputTable(result) {
    console.log('\n' + chalk.bold('='.repeat(80)));
    console.log(chalk.bold('PLAYWRIGHT TEST IMPACT ANALYSIS'));
    console.log(chalk.bold('='.repeat(80)));
    console.log(`\n${chalk.bold('Commits:')}`);
    console.log(`  Base: ${chalk.cyan(result.baseCommit)}`);
    console.log(`  Head: ${chalk.cyan(result.headCommit)}`);
    console.log(`\n${chalk.bold('Summary:')}`);
    console.log(`  Total files changed: ${result.summary.totalFilesChanged}`);
    console.log(`  Test files changed: ${result.summary.testFilesChanged}`);
    console.log(`  Tests added: ${chalk.green(result.summary.testsAdded)}`);
    console.log(`  Tests removed: ${chalk.red(result.summary.testsRemoved)}`);
    console.log(`  Tests modified: ${chalk.yellow(result.summary.testsModified)}`);
    if (result.changedFiles.length > 0) {
        console.log(`\n${chalk.bold('Changed Files:')}`);
        for (const file of result.changedFiles) {
            const icon = file.isTestFile ? '[TEST]' : '[FILE]';
            const color = file.changeType === 'added'
                ? chalk.green
                : file.changeType === 'deleted'
                    ? chalk.red
                    : file.changeType === 'renamed'
                        ? chalk.blue
                        : chalk.yellow;
            console.log(`  ${icon} ${color(file.changeType.padEnd(8))} ${file.filePath}`);
        }
    }
    if (result.directlyImpactedTests.length > 0) {
        console.log(`\n${chalk.bold('Directly Impacted Tests:')}`);
        const groupedByFile = groupTestsByFile(result.directlyImpactedTests);
        for (const [filePath, tests] of Object.entries(groupedByFile)) {
            console.log(`\n  ${chalk.cyan(filePath)}:`);
            for (const test of tests) {
                const icon = test.type === 'added'
                    ? chalk.green('+')
                    : test.type === 'removed'
                        ? chalk.red('-')
                        : chalk.yellow('~');
                const kindIcon = test.changeKind === 'describe' ? '[SUITE]' : '[TEST]';
                const lineInfo = test.lineNumber ? `:${test.lineNumber}` : '';
                console.log(`    ${icon} ${kindIcon} ${test.testName}${chalk.gray(lineInfo)}`);
            }
        }
    }
    else {
        console.log(`\n${chalk.gray('No directly impacted tests found.')}`);
    }
    console.log('\n' + chalk.bold('='.repeat(80)));
}
function groupTestsByFile(tests) {
    return tests.reduce((acc, test) => {
        if (!acc[test.filePath]) {
            acc[test.filePath] = [];
        }
        acc[test.filePath].push(test);
        return acc;
    }, {});
}
program.parse();
//# sourceMappingURL=cli.js.map