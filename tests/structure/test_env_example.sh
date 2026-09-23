#!/bin/bash

# Test script to verify the root .env.example per T005
# (documents DB, JWT/Strapi core secrets, SMTP and frontend/cross-cutting
# variables, per plan.md Constraints — Principe IV: aucun secret en clair)

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

assert_not_contains() {
    local file=$1
    local needle=$2
    local msg=$3
    test_count=$((test_count + 1))

    if [ -f "$file" ] && ! grep -q "$needle" "$file"; then
        echo "✓ PASS: $msg"
        pass_count=$((pass_count + 1))
    else
        echo "✗ FAIL: $msg"
        echo "  Did not expect '$needle' in: $file"
        fail_count=$((fail_count + 1))
    fi
}

cd "$(git rev-parse --show-toplevel)"

ENV_FILE=".env.example"

echo "=== Testing root .env.example (T005) ==="
echo ""

assert_file_exists "$ENV_FILE" "root .env.example exists"

echo ""
echo "--- DB variables (backend/config/database.ts) ---"
for var in DATABASE_CLIENT DATABASE_URL DATABASE_HOST DATABASE_PORT DATABASE_NAME \
           DATABASE_USERNAME DATABASE_PASSWORD DATABASE_SSL DATABASE_FILENAME; do
    assert_contains "$ENV_FILE" "^${var}=" "$ENV_FILE documents $var"
done

echo ""
echo "--- JWT / Strapi core secrets ---"
for var in APP_KEYS ADMIN_JWT_SECRET API_TOKEN_SALT TRANSFER_TOKEN_SALT JWT_SECRET ENCRYPTION_KEY; do
    assert_contains "$ENV_FILE" "^${var}=" "$ENV_FILE documents $var"
done

echo ""
echo "--- SMTP variables (Strapi Email plugin / Nodemailer, per research.md) ---"
for var in SMTP_HOST SMTP_PORT SMTP_USERNAME SMTP_PASSWORD SMTP_DEFAULT_FROM SMTP_DEFAULT_REPLY_TO; do
    assert_contains "$ENV_FILE" "^${var}=" "$ENV_FILE documents $var"
done

echo ""
echo "--- Frontend / cross-cutting variables (per T053: API base URL) ---"
assert_contains "$ENV_FILE" "^NEXT_PUBLIC_API_BASE_URL=" "$ENV_FILE documents NEXT_PUBLIC_API_BASE_URL"

echo ""
echo "--- Development auteur account (T062, development only) ---"
for var in DEV_AUTEUR_EMAIL DEV_AUTEUR_PASSWORD DEV_AUTEUR_NOM; do
    assert_contains "$ENV_FILE" "^${var}=$" "$ENV_FILE documents $var with an empty value"
done

echo ""
echo "--- Principe IV: no real secret committed, only obvious placeholders ---"
assert_not_contains "$ENV_FILE" "BEGIN.*PRIVATE KEY" "$ENV_FILE contains no embedded private key material"
test_count=$((test_count + 1))
if [ -f "$ENV_FILE" ] && grep -qiE "changeme|tobemodified|example\.com|your-" "$ENV_FILE"; then
    echo "✓ PASS: $ENV_FILE uses obvious placeholder markers (changeme/tobemodified/example.com/your-...)"
    pass_count=$((pass_count + 1))
else
    echo "✗ FAIL: $ENV_FILE uses obvious placeholder markers (changeme/tobemodified/example.com/your-...)"
    fail_count=$((fail_count + 1))
fi

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
