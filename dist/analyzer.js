import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class PlaywrightTestImpactAnalyzer {
    repositoryPath;
    constructor(repositoryPath = process.cwd()) {
        this.repositoryPath = repositoryPath;
    }
    /**
     * Analyzes the impact between two Git commits
     */
    analyze(baseCommit, headCommit) {
        const changedFiles = this.getChangedFiles(baseCommit, headCommit);
        const fileChanges = [];
        const directlyImpactedTests = [];
        const indirectlyImpactedTests = [];
        // Separate test files and non-test files
        const changedTestFiles = [];
        const changedNonTestFiles = [];
        for (const file of changedFiles) {
            const isTestFile = this.isPlaywrightTestFile(file.path);
            const fileChange = {
                filePath: file.path,
                changeType: file.changeType,
                isTestFile,
            };
            if (isTestFile) {
                changedTestFiles.push(file);
                const testChanges = this.analyzeTestFileChanges(baseCommit, headCommit, file.path);
                fileChange.testChanges = testChanges;
                directlyImpactedTests.push(...testChanges);
            }
            else {
                changedNonTestFiles.push(file);
            }
            fileChanges.push(fileChange);
        }
        // Analyze indirect impact from non-test file changes
        if (changedNonTestFiles.length > 0) {
            const indirectImpacts = this.analyzeIndirectImpact(baseCommit, headCommit, changedNonTestFiles, changedTestFiles);
            indirectlyImpactedTests.push(...indirectImpacts);
        }
        return {
            baseCommit,
            headCommit,
            changedFiles: fileChanges,
            directlyImpactedTests,
            indirectlyImpactedTests,
            summary: {
                totalFilesChanged: fileChanges.length,
                testFilesChanged: fileChanges.filter((f) => f.isTestFile).length,
                testsAdded: directlyImpactedTests.filter((t) => t.type === 'added')
                    .length,
                testsRemoved: directlyImpactedTests.filter((t) => t.type === 'removed')
                    .length,
                testsModified: directlyImpactedTests.filter((t) => t.type === 'modified')
                    .length,
                testsIndirectlyImpacted: indirectlyImpactedTests.length,
            },
        };
    }
    /**
     * Analyzes indirect impact by checking which tests import changed non-test files
     */
    analyzeIndirectImpact(baseCommit, headCommit, changedNonTestFiles, changedTestFiles) {
        const indirectImpacts = [];
        const changedNonTestPaths = new Set(changedNonTestFiles.map(f => f.path));
        // Get all test files in the repository at head commit
        const allTestFiles = this.getAllTestFiles(headCommit);
        // Filter out test files that were already directly changed
        const unchangedTestFiles = allTestFiles.filter(testFile => !changedTestFiles.some(cf => cf.path === testFile));
        for (const testFile of unchangedTestFiles) {
            try {
                // Get test file content at head commit
                const testContent = execSync(`git show ${headCommit}:${testFile} 2>/dev/null`, { cwd: this.repositoryPath, encoding: 'utf-8' });
                // Extract imports from the test file
                const imports = this.extractImports(testContent);
                // Check if any import matches a changed non-test file
                for (const importInfo of imports) {
                    const resolvedPath = this.resolveImportPath(importInfo.source, testFile, headCommit);
                    if (resolvedPath && changedNonTestPaths.has(resolvedPath)) {
                        // This test file imports a changed non-test file
                        // Extract all tests from this file and mark them as indirectly impacted
                        const tests = this.extractTestsFromContent(testContent, testFile);
                        for (const test of tests) {
                            indirectImpacts.push({
                                type: 'modified',
                                testName: test.testName,
                                filePath: testFile,
                                lineNumber: test.lineNumber,
                                changeKind: test.kind,
                                impactType: 'indirect',
                                impactedBy: resolvedPath,
                            });
                        }
                        // Break after finding first matching import for this test file
                        // to avoid duplicate entries
                        break;
                    }
                }
            }
            catch (error) {
                // File might not exist at this commit, skip
            }
        }
        return indirectImpacts;
    }
    /**
     * Gets all test files in the repository at a specific commit
     */
    getAllTestFiles(commit) {
        try {
            const output = execSync(`git ls-tree -r --name-only ${commit}`, { cwd: this.repositoryPath, encoding: 'utf-8' });
            return output
                .trim()
                .split('\n')
                .filter(file => this.isPlaywrightTestFile(file));
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Extracts import statements from file content
     */
    extractImports(content) {
        const imports = [];
        const lines = content.split('\n');
        // ES6 import patterns
        const es6ImportPattern = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"];?/g;
        // CommonJS require patterns
        const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Match ES6 imports
            let match;
            es6ImportPattern.lastIndex = 0;
            while ((match = es6ImportPattern.exec(line)) !== null) {
                imports.push({
                    source: match[1],
                    lineNumber: i + 1,
                });
            }
            // Match require statements
            requirePattern.lastIndex = 0;
            while ((match = requirePattern.exec(line)) !== null) {
                imports.push({
                    source: match[1],
                    lineNumber: i + 1,
                });
            }
        }
        return imports;
    }
    /**
     * Resolves an import path to an actual file path relative to repository root
     */
    resolveImportPath(importSource, importingFile, commit) {
        // Skip external packages (non-relative and non-absolute imports)
        if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
            return null;
        }
        // Get the directory of the importing file
        const importingDir = path.dirname(importingFile);
        // Resolve the import path
        let resolvedPath = path.normalize(path.join(importingDir, importSource));
        // Remove leading slash if present
        if (resolvedPath.startsWith('/')) {
            resolvedPath = resolvedPath.slice(1);
        }
        // Try different extensions and index files
        const possiblePaths = [
            resolvedPath,
            `${resolvedPath}.ts`,
            `${resolvedPath}.js`,
            `${resolvedPath}.tsx`,
            `${resolvedPath}.jsx`,
            path.join(resolvedPath, 'index.ts'),
            path.join(resolvedPath, 'index.js'),
            path.join(resolvedPath, 'index.tsx'),
            path.join(resolvedPath, 'index.jsx'),
        ];
        // Check which path exists at the given commit
        for (const testPath of possiblePaths) {
            try {
                execSync(`git cat-file -e ${commit}:${testPath} 2>/dev/null`, { cwd: this.repositoryPath, encoding: 'utf-8' });
                return testPath;
            }
            catch {
                // Path doesn't exist, try next
            }
        }
        return null;
    }
    /**
     * Gets all changed files between two commits
     */
    getChangedFiles(baseCommit, headCommit) {
        try {
            const output = execSync(`git diff --name-status ${baseCommit}..${headCommit}`, { cwd: this.repositoryPath, encoding: 'utf-8' });
            const files = [];
            const lines = output.trim().split('\n');
            for (const line of lines) {
                if (!line.trim())
                    continue;
                const parts = line.split('\t');
                const status = parts[0]?.[0];
                let filePath;
                let changeType;
                switch (status) {
                    case 'A':
                        changeType = 'added';
                        filePath = parts[1];
                        break;
                    case 'D':
                        changeType = 'deleted';
                        filePath = parts[1];
                        break;
                    case 'M':
                        changeType = 'modified';
                        filePath = parts[1];
                        break;
                    case 'R':
                        changeType = 'renamed';
                        filePath = parts[2]; // New path
                        break;
                    default:
                        continue;
                }
                if (filePath) {
                    files.push({ path: filePath, changeType });
                }
            }
            return files;
        }
        catch (error) {
            throw new Error(`Failed to get changed files: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Checks if a file is a Playwright test file
     */
    isPlaywrightTestFile(filePath) {
        const testFilePatterns = [
            /\.spec\.(ts|js|tsx|jsx)$/,
            /\.test\.(ts|js|tsx|jsx)$/,
            /playwright\.(ts|js|config\.(ts|js))$/,
        ];
        return testFilePatterns.some((pattern) => pattern.test(filePath));
    }
    /**
     * Analyzes changes in a test file between two commits
     */
    analyzeTestFileChanges(baseCommit, headCommit, filePath) {
        const testChanges = [];
        try {
            // Get file content at base commit
            let baseContent = null;
            try {
                baseContent = execSync(`git show ${baseCommit}:${filePath} 2>/dev/null`, { cwd: this.repositoryPath, encoding: 'utf-8' });
            }
            catch {
                // File didn't exist in base commit
            }
            // Get file content at head commit
            let headContent = null;
            try {
                headContent = execSync(`git show ${headCommit}:${filePath} 2>/dev/null`, { cwd: this.repositoryPath, encoding: 'utf-8' });
            }
            catch {
                // File doesn't exist in head commit (deleted)
            }
            const baseTests = baseContent
                ? this.extractTestsFromContent(baseContent, filePath)
                : [];
            const headTests = headContent
                ? this.extractTestsFromContent(headContent, filePath)
                : [];
            // Find added tests
            for (const headTest of headTests) {
                const matchingBaseTest = baseTests.find((t) => t.testName === headTest.testName && t.kind === headTest.kind);
                if (!matchingBaseTest) {
                    testChanges.push({
                        type: 'added',
                        testName: headTest.testName,
                        filePath,
                        lineNumber: headTest.lineNumber,
                        changeKind: headTest.kind,
                        impactType: 'direct',
                    });
                }
                else if (matchingBaseTest.content !== headTest.content) {
                    // Test was modified
                    testChanges.push({
                        type: 'modified',
                        testName: headTest.testName,
                        filePath,
                        lineNumber: headTest.lineNumber,
                        changeKind: headTest.kind,
                        impactType: 'direct',
                    });
                }
            }
            // Find removed tests
            for (const baseTest of baseTests) {
                const matchingHeadTest = headTests.find((t) => t.testName === baseTest.testName && t.kind === baseTest.kind);
                if (!matchingHeadTest) {
                    testChanges.push({
                        type: 'removed',
                        testName: baseTest.testName,
                        filePath,
                        lineNumber: baseTest.lineNumber,
                        changeKind: baseTest.kind,
                        impactType: 'direct',
                    });
                }
            }
        }
        catch (error) {
            console.error(`Error analyzing ${filePath}:`, error);
        }
        return testChanges;
    }
    /**
     * Extracts test definitions from file content, including full test body
     */
    extractTestsFromContent(content, filePath) {
        const tests = [];
        const lines = content.split('\n');
        // Playwright test patterns - individual tests
        const testPatterns = [
            // test('name', ...)
            // test("name", ...)
            // test(`name`, ...)
            { pattern: /test\s*\(\s*['"`](.+?)['"`]/g, kind: 'test' },
            // test.only('name', ...)
            { pattern: /test\.only\s*\(\s*['"`](.+?)['"`]/g, kind: 'test' },
            // test.skip('name', ...)
            { pattern: /test\.skip\s*\(\s*['"`](.+?)['"`]/g, kind: 'test' },
        ];
        // Test suite patterns (describe blocks)
        const describePatterns = [
            // test.describe('name', ...)
            { pattern: /test\.describe\s*\(\s*['"`](.+?)['"`]/g, kind: 'describe' },
            // test.describe.only('name', ...)
            { pattern: /test\.describe\.only\s*\(\s*['"`](.+?)['"`]/g, kind: 'describe' },
            // test.describe.skip('name', ...)
            { pattern: /test\.describe\.skip\s*\(\s*['"`](.+?)['"`]/g, kind: 'describe' },
        ];
        const allPatterns = [...testPatterns, ...describePatterns];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const { pattern, kind } of allPatterns) {
                pattern.lastIndex = 0; // Reset regex
                const match = pattern.exec(line);
                if (match) {
                    // Extract full test body content by tracking brace depth
                    const fullContent = this.extractTestBody(lines, i);
                    tests.push({
                        testName: match[1],
                        lineNumber: i + 1,
                        content: fullContent,
                        kind,
                    });
                }
            }
        }
        return tests;
    }
    /**
     * Extracts the full test body by tracking opening and closing braces
     * This ensures we capture all content within the test function
     */
    extractTestBody(lines, startLine) {
        const bodyLines = [];
        let braceDepth = 0;
        let started = false;
        for (let i = startLine; i < lines.length; i++) {
            const line = lines[i];
            bodyLines.push(line);
            // Count braces (simplified - doesn't handle braces in strings/comments perfectly,
            // but good enough for detecting changes)
            for (const char of line) {
                if (char === '{') {
                    braceDepth++;
                    started = true;
                }
                else if (char === '}') {
                    braceDepth--;
                }
            }
            // If we've started and returned to depth 0, we've found the end
            if (started && braceDepth === 0) {
                break;
            }
            // Safety limit: don't extract more than 500 lines for a single test
            if (bodyLines.length > 500) {
                break;
            }
        }
        return bodyLines.join('\n');
    }
}
//# sourceMappingURL=analyzer.js.map