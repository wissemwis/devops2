#!/bin/bash

# Test script to verify ESLint + Prettier configuration per T004
# (linting/formatting configured for both backend/ and frontend/)

set -e

test_count=0
pass_count=0
fail_count=0

assert_file_exists() {
    local file=$1
    local msg=$2
    test_count=$((test_count + 1))

    if [ -f "$file" ]; then
        echo "✓ PASS: $msg"
        pass_count=$((pass_count + 1))
    else
        echo "✗ FAIL: $msg"
        echo "  Expected file: $file"
        fail_count=$((fail_count + 1))
    fi
}

assert_contains() {
    local file=$1
    local needle=$2
    local msg=$3
    test_count=$((test_count + 1))

    if [ -f "$file" ] && grep -q "$needle" "$file"; then
        echo "✓ PASS: $msg"
        pass_count=$((pass_count + 1))
    else
        echo "✗ FAIL: $msg"
        echo "  Expected '$needle' in: $file"
        fail_count=$((fail_count + 1))
    fi
}

# Like assert_file_exists but accepts any one of several candidate paths
assert_any_file_exists() {
    local msg=$1
    shift
    local candidates=("$@")
    test_count=$((test_count + 1))

    for f in "${candidates[@]}"; do
        if [ -f "$f" ]; then
            echo "✓ PASS: $msg ($f)"
            pass_count=$((pass_count + 1))
            return
        fi
    done

    echo "✗ FAIL: $msg"
    echo "  Expected one of: ${candidates[*]}"
    fail_count=$((fail_count + 1))
}

cd "$(git rev-parse --show-toplevel)"

echo "=== Testing Lint/Format Configuration (T004) ==="
echo ""

echo "--- backend/ ---"
assert_any_file_exists "backend/ ESLint config exists" \
    "backend/eslint.config.js" "backend/eslint.config.mjs" "backend/eslint.config.cjs" "backend/eslint.config.ts"
assert_any_file_exists "backend/ Prettier config exists" \
    "backend/.prettierrc" "backend/.prettierrc.json" "backend/.prettierrc.js" "backend/prettier.config.js" "backend/prettier.config.mjs"
assert_any_file_exists "backend/ .prettierignore exists (or shared root one)" \
    "backend/.prettierignore" ".prettierignore"
assert_contains "backend/package.json" "\"lint\"" "backend/package.json declares a lint script"
assert_contains "backend/package.json" "\"format\"" "backend/package.json declares a format script"
assert_contains "backend/package.json" "\"eslint\"" "backend/package.json devDependencies include eslint"
assert_contains "backend/package.json" "\"prettier\"" "backend/package.json devDependencies include prettier"
assert_contains "backend/package.json" "typescript-eslint" "backend/package.json devDependencies include a TypeScript ESLint setup"

echo ""
echo "--- frontend/ ---"
assert_any_file_exists "frontend/ ESLint config exists" \
    "frontend/eslint.config.js" "frontend/eslint.config.mjs" "frontend/eslint.config.cjs" "frontend/eslint.config.ts"
assert_any_file_exists "frontend/ Prettier config exists" \
    "frontend/.prettierrc" "frontend/.prettierrc.json" "frontend/.prettierrc.js" "frontend/prettier.config.js" "frontend/prettier.config.mjs"
assert_any_file_exists "frontend/ .prettierignore exists (or shared root one)" \
    "frontend/.prettierignore" ".prettierignore"
assert_contains "frontend/package.json" "\"lint\"" "frontend/package.json declares a lint script"
assert_contains "frontend/package.json" "\"format\"" "frontend/package.json declares a format script"
assert_contains "frontend/package.json" "\"prettier\"" "frontend/package.json devDependencies include prettier"

echo ""
echo "=== Test Results ==="
echo "Total: $test_count | Passed: $pass_count | Failed: $fail_count"

if [ $fail_count -eq 0 ]; then
    echo ""
    echo "✓ All tests passed!"
    exit 0
else
    echo ""
    echo "✗ Some tests failed"
    exit 1
fi
