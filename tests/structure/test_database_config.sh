#!/bin/bash

# Test script to verify PostgreSQL/SQLite configuration per T006
# (backend/config/database.ts implements research.md's Persistance decision:
# "PostgreSQL en CI/production, SQLite toléré en développement local", via
# Strapi's native multi-client support driven by DATABASE_CLIENT and friends)

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

DB_CONFIG="backend/config/database.ts"

echo "=== Testing PostgreSQL/SQLite configuration (T006) ==="
echo ""

assert_file_exists "$DB_CONFIG" "$DB_CONFIG exists"

echo ""
echo "--- Client selection (SQLite en dev par défaut) ---"
assert_contains "$DB_CONFIG" "env('DATABASE_CLIENT', 'sqlite')" \
    "$DB_CONFIG defaults DATABASE_CLIENT to sqlite for local dev"

echo ""
echo "--- PostgreSQL branch (CI/production, per research.md) ---"
assert_contains "$DB_CONFIG" "client: 'postgres'" "$DB_CONFIG defines a postgres client branch"
for var in DATABASE_URL DATABASE_HOST DATABASE_PORT DATABASE_NAME DATABASE_USERNAME \
           DATABASE_PASSWORD DATABASE_SSL DATABASE_SCHEMA; do
    assert_contains "$DB_CONFIG" "$var" "$DB_CONFIG postgres branch reads $var"
done
assert_contains "$DB_CONFIG" "DATABASE_POOL_MIN" "$DB_CONFIG configures pool min from env"
assert_contains "$DB_CONFIG" "DATABASE_POOL_MAX" "$DB_CONFIG configures pool max from env"

echo ""
echo "--- SQLite branch (dev local) ---"
assert_contains "$DB_CONFIG" "client: 'sqlite'" "$DB_CONFIG defines a sqlite client branch"
assert_contains "$DB_CONFIG" "DATABASE_FILENAME" "$DB_CONFIG sqlite branch reads DATABASE_FILENAME"

echo ""
echo "--- pg driver actually installed (postgres client is unusable at runtime without it) ---"
assert_contains "backend/package.json" "\"pg\":" \
    "backend/package.json declares the pg dependency needed by the postgres client at runtime"

echo ""
echo "--- backend/.env.example documents DB vars for local 'strapi develop' DX ---"
echo "    (Strapi CLI tooling reads backend/.env, not the root .env.example)"
for var in DATABASE_CLIENT DATABASE_FILENAME; do
    assert_contains "backend/.env.example" "^${var}=" "backend/.env.example documents $var"
done

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
