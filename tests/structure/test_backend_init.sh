#!/bin/bash

# Test script to verify the Strapi 5 backend scaffold per T002
# (backend/ initialized with the TypeScript template, Node.js 20 LTS)

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

cd "$(git rev-parse --show-toplevel)"

echo "=== Testing Backend Strapi 5 Scaffold (T002) ==="
echo ""

assert_file_exists "backend/package.json" "backend/package.json exists"
assert_contains "backend/package.json" "@strapi/strapi" "package.json declares the @strapi/strapi dependency"
assert_contains "backend/package.json" "\"node\": \">=20" "package.json engines require Node.js 20 LTS or newer"
assert_file_exists "backend/tsconfig.json" "backend/tsconfig.json exists (TypeScript template)"
assert_file_exists "backend/src/index.ts" "backend/src/index.ts exists (TypeScript source entrypoint)"
assert_file_exists "backend/config/database.ts" "backend/config/database.ts exists"
assert_file_exists "backend/.env.example" "backend/.env.example exists"

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
