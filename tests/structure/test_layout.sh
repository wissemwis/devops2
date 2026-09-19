#!/bin/bash

# Test script to verify project structure per T001
# This is a scaffolding test using simple shell assertions

set -e  # Exit on first failure

test_count=0
pass_count=0
fail_count=0

# Helper function to assert directory structure
assert_dir_exists() {
    local dir=$1
    local msg=$2
    test_count=$((test_count + 1))

    if [ -d "$dir" ]; then
        echo "✓ PASS: $msg"
        pass_count=$((pass_count + 1))
    else
        echo "✗ FAIL: $msg"
        echo "  Expected directory: $dir"
        fail_count=$((fail_count + 1))
    fi
}

# Change to repo root
cd "$(git rev-parse --show-toplevel)"

echo "=== Testing Project Structure (T001) ==="
echo ""

# Backend structure
echo "Testing backend/ structure..."
assert_dir_exists "backend/src/api/questionnaire" "backend/src/api/questionnaire"
assert_dir_exists "backend/src/api/question" "backend/src/api/question"
assert_dir_exists "backend/src/api/response" "backend/src/api/response"
assert_dir_exists "backend/src/api/user-role" "backend/src/api/user-role"
assert_dir_exists "backend/tests/contract" "backend/tests/contract"
assert_dir_exists "backend/tests/integration" "backend/tests/integration"

echo ""
echo "Testing frontend/ structure..."
# Frontend structure
assert_dir_exists "frontend/src/components" "frontend/src/components"
assert_dir_exists "frontend/src/pages" "frontend/src/pages"
assert_dir_exists "frontend/src/services" "frontend/src/services"
assert_dir_exists "frontend/tests/unit" "frontend/tests/unit"
assert_dir_exists "frontend/tests/integration" "frontend/tests/integration"

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
