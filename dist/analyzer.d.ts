export type TestChangeType = 'test' | 'describe';
export interface TestChange {
    type: 'added' | 'removed' | 'modified';
    testName: string;
    filePath: string;
    lineNumber?: number;
    changeKind: TestChangeType;
    impactType: 'direct' | 'indirect';
    impactedBy?: string;
}
export interface FileChange {
    filePath: string;
    changeType: 'added' | 'deleted' | 'modified' | 'renamed';
    isTestFile: boolean;
    testChanges?: TestChange[];
}
export interface ImpactAnalysisResult {
    baseCommit: string;
    headCommit: string;
    changedFiles: FileChange[];
    directlyImpactedTests: TestChange[];
    indirectlyImpactedTests: TestChange[];
    summary: {
        totalFilesChanged: number;
        testFilesChanged: number;
        testsAdded: number;
        testsRemoved: number;
        testsModified: number;
        testsIndirectlyImpacted: number;
    };
}
export declare class PlaywrightTestImpactAnalyzer {
    private repositoryPath;
    constructor(repositoryPath?: string);
    /**
     * Analyzes the impact between two Git commits
     */
    analyze(baseCommit: string, headCommit: string): ImpactAnalysisResult;
    /**
     * Analyzes indirect impact by checking which tests import changed non-test files
     */
    private analyzeIndirectImpact;
    /**
     * Gets all test files in the repository at a specific commit
     */
    private getAllTestFiles;
    /**
     * Extracts import statements from file content
     */
    private extractImports;
    /**
     * Resolves an import path to an actual file path relative to repository root
     */
    private resolveImportPath;
    /**
     * Gets all changed files between two commits
     */
    private getChangedFiles;
    /**
     * Checks if a file is a Playwright test file
     */
    private isPlaywrightTestFile;
    /**
     * Analyzes changes in a test file between two commits
     */
    private analyzeTestFileChanges;
    /**
     * Extracts test definitions from file content, including full test body
     */
    private extractTestsFromContent;
    /**
     * Extracts the full test body by tracking opening and closing braces
     * This ensures we capture all content within the test function
     */
    private extractTestBody;
}
//# sourceMappingURL=analyzer.d.ts.map