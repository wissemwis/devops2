#!/bin/bash

# Test script to verify the Next.js frontend scaffold per T003
# (frontend/ initialized with App Router + TypeScript enabled via tsconfig.json)

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
# (e.g. next.config.js vs next.config.ts, app/layout.tsx vs app/layout.js)
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

echo "=== Testing Frontend Next.js Scaffold (T003) ==="
echo ""

assert_file_exists "frontend/package.json" "frontend/package.json exists"
assert_contains "frontend/package.json" "\"next\"" "package.json declares the next dependency"
assert_file_exists "frontend/tsconfig.json" "frontend/tsconfig.json exists (TypeScript enabled)"
assert_any_file_exists "frontend/next.config.* exists" \
    "frontend/next.config.js" "frontend/next.config.ts" "frontend/next.config.mjs"
assert_file_exists "frontend/app/layout.tsx" "frontend/app/layout.tsx exists (App Router root layout, TypeScript)"
assert_file_exists "frontend/app/page.tsx" "frontend/app/page.tsx exists (App Router root page, TypeScript)"
assert_contains "frontend/tsconfig.json" "\"strict\"" "tsconfig.json declares strict mode setting"

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
