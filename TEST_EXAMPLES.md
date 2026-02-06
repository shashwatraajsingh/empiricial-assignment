# Test Commands - Direct vs Indirect Impact Examples

## 📋 Direct Impact Examples (Test Files Modified)

### Example 1: Commit 75cdcc5 - Test Added
**Description:** Adds a new test for safeBash tool execution

**Command:**
```bash
node dist/cli.js analyze --base 75cdcc5~1 --head 75cdcc5 --repo ./flash-tests --format runnable
```

**Expected Output:**
- ✅ 1 test added (direct)
- File: `tests/tool-execution/session.spec.ts`
- Test: "safeBash tool execution to get commit SHA"

---

### Example 2: Commit 6d8159d - Test Removed
**Description:** Removes the "Sort sessions by title" test

**Command:**
```bash
node dist/cli.js analyze --base 6d8159d~1 --head 6d8159d --repo ./flash-tests --format runnable
```

**Expected Output:**
- ✅ 1 test removed (direct)
- File: `tests/sessions.spec.ts`
- Test: "Sort sessions by title"

---

## 🔗 Indirect Impact Examples (Helper Files Modified)

### Example 3: Commit 45433fd - Helper Method Modified
**Description:** Modifies `tests/pages/test-runs.ts` helper file

**Command:**
```bash
node dist/cli.js analyze --base 45433fd~1 --head 45433fd --repo ./flash-tests --format runnable
```

**Expected Output:**
- ✅ 29 tests impacted (indirect)
- Files: `tests/test-runs.spec.ts`, `tests/tool-execution/session.spec.ts`
- All tests marked as `[indirect]`
- Shows: `└─ impacted by: tests/pages/test-runs.ts`

---

### Example 4: Commit 853ca28 - Package Upgrade
**Description:** Upgrades npm packages (package.json and package-lock.json)

**Command:**
```bash
node dist/cli.js analyze --base 853ca28~1 --head 853ca28 --repo ./flash-tests --format runnable
```

**Expected Output:**
- ✅ 0 tests impacted
- Reason: package.json is not a test file and not imported by tests
- This shows the tool correctly filters out non-test-related changes

---

## 📊 Summary Table

| Commit | Type | Impact | Test Count | Files Changed |
|--------|------|--------|------------|---------------|
| **75cdcc5** | Direct | Added | 1 | tests/tool-execution/session.spec.ts |
| **6d8159d** | Direct | Removed | 1 | tests/sessions.spec.ts |
| **45433fd** | Indirect | Modified | 29 | tests/pages/test-runs.ts → 2 test files |
| **853ca28** | None | N/A | 0 | package.json (not test-related) |

---

## 🎯 Quick Test All 4 Examples

```bash
# Navigate to project
cd /home/shashwat/Desktop/empirical

# Ensure build is up to date
npm run build

# Test 1: Direct - Test Added
echo "=== TEST 1: Direct Impact - Test Added ===" && \
node dist/cli.js analyze --base 75cdcc5~1 --head 75cdcc5 --repo ./flash-tests --format runnable

# Test 2: Direct - Test Removed
echo "=== TEST 2: Direct Impact - Test Removed ===" && \
node dist/cli.js analyze --base 6d8159d~1 --head 6d8159d --repo ./flash-tests --format runnable

# Test 3: Indirect - Helper Modified
echo "=== TEST 3: Indirect Impact - Helper Modified ===" && \
node dist/cli.js analyze --base 45433fd~1 --head 45433fd --repo ./flash-tests --format runnable | head -60

# Test 4: No Impact - Package Upgrade
echo "=== TEST 4: No Impact - Package Upgrade ===" && \
node dist/cli.js analyze --base 853ca28~1 --head 853ca28 --repo ./flash-tests --format runnable
```

---

## 🎬 For Video Demo - Use These 3

**Best for 2-minute video:**

1. **75cdcc5** - Shows test added (clean, simple)
2. **6d8159d** - Shows test removed (clean, simple)
3. **45433fd** - Shows indirect impact (impressive - 29 tests!)

Skip the package upgrade example in the video to save time.

---

## 📝 Additional Direct Impact Examples

### Commit 5df7e4d - Tests Modified
```bash
node dist/cli.js analyze --base 5df7e4d~1 --head 5df7e4d --repo ./flash-tests --format runnable
```
- 2 tests modified (direct)
- File: `tests/sessions.spec.ts`

### Commit 3b4d4e1 - Test Modified
```bash
node dist/cli.js analyze --base 3b4d4e1~1 --head 3b4d4e1 --repo ./flash-tests --format runnable
```
- Tests modified in `tests/test-runs.spec.ts`

---

## 🔍 How to Find More Examples

### Find commits that modify test files (direct impact):
```bash
cd flash-tests
git log --oneline --all -- 'tests/*.spec.ts' | head -20
```

### Find commits that modify helper files (indirect impact):
```bash
cd flash-tests
git log --oneline --all -- 'tests/pages/*.ts' 'tests/utils/*.ts' | head -20
```

### Find commits that add tests:
```bash
cd flash-tests
git log --oneline --diff-filter=A -- 'tests/*.spec.ts' | head -10
```

### Find commits that remove tests:
```bash
cd flash-tests
git log --oneline --diff-filter=D -- 'tests/*.spec.ts' | head -10
```
