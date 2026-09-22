#!/bin/bash

# Test script to verify the Strapi users-permissions User content-type extension
# per T007 (backend/src/extensions/users-permissions/content-types/user/schema.json
# adds the `role` field per data-model.md's "Utilisateur" section / FR-016).

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

assert_valid_json() {
    local file=$1
    local msg=$2
    test_count=$((test_count + 1))

    if [ -f "$file" ] && node -e "JSON.parse(require('fs').readFileSync('$file', 'utf8'))" 2>/dev/null; then
        echo "✓ PASS: $msg"
        pass_count=$((pass_count + 1))
    else
        echo "✗ FAIL: $msg"
        echo "  Expected valid JSON: $file"
        fail_count=$((fail_count + 1))
    fi
}

cd "$(git rev-parse --show-toplevel)"

USER_SCHEMA="backend/src/extensions/users-permissions/content-types/user/schema.json"

echo "=== Testing users-permissions User content-type role extension (T007) ==="
echo ""

assert_file_exists "$USER_SCHEMA" "$USER_SCHEMA exists"

echo ""
echo "--- Schema is valid, well-formed JSON ---"
assert_valid_json "$USER_SCHEMA" "$USER_SCHEMA is valid JSON"

echo ""
echo "--- role attribute (data-model.md Utilisateur: enum, requis, FR-016) ---"
assert_contains "$USER_SCHEMA" '"role"' "$USER_SCHEMA declares a role attribute"
assert_contains "$USER_SCHEMA" '"type": "enumeration"' "$USER_SCHEMA role attribute is type enumeration"
assert_contains "$USER_SCHEMA" '"required": true' "$USER_SCHEMA role attribute is required"

echo ""
echo "--- role enum values (auteur, repondant, administrateur — ASCII-normalized) ---"
for value in auteur repondant administrateur; do
    assert_contains "$USER_SCHEMA" "\"$value\"" "$USER_SCHEMA role enum contains \"$value\""
done

echo ""
echo "--- Extension schema declares exactly 3 role values (no stray 4th/typo) ---"
test_count=$((test_count + 1))
role_enum_count=$(node -e "
const schema = JSON.parse(require('fs').readFileSync('$USER_SCHEMA', 'utf8'));
const role = schema.attributes && schema.attributes.role;
if (role && role.type === 'enumeration' && Array.isArray(role.enum)) {
    console.log(role.enum.length);
} else {
    console.log(0);
}
" 2>/dev/null || echo 0)
if [ "$role_enum_count" = "3" ]; then
    echo "✓ PASS: $USER_SCHEMA role.enum has exactly 3 values"
    pass_count=$((pass_count + 1))
else
    echo "✗ FAIL: $USER_SCHEMA role.enum has exactly 3 values"
    echo "  Expected 3, got: $role_enum_count"
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
