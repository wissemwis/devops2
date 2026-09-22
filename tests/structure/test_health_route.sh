#!/bin/bash

# Test script to verify the GET /health route + controller per T008
# (backend/src/api/health/routes/health.ts + backend/src/api/health/controllers/health.ts
# implement contracts/api.md's "## Santé (Principe V — Observabilité)" / "### GET /health":
# public route, 200 {"status":"ok"} when the DB is reachable, 503
# {"status":"degraded","reason":"<cause>"} when it is not.)

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

ROUTE_FILE="backend/src/api/health/routes/health.ts"
CONTROLLER_FILE="backend/src/api/health/controllers/health.ts"

echo "=== Testing GET /health route + controller (T008) ==="
echo ""

echo "--- Files exist (Strapi 5 custom API route/controller layout) ---"
assert_file_exists "$ROUTE_FILE" "$ROUTE_FILE exists"
assert_file_exists "$CONTROLLER_FILE" "$CONTROLLER_FILE exists"

echo ""
echo "--- Route definition (contracts/api.md: GET /health, no auth) ---"
assert_contains "$ROUTE_FILE" "/health" "$ROUTE_FILE declares the /health path"
assert_contains "$ROUTE_FILE" "GET" "$ROUTE_FILE declares the GET method"
assert_contains "$ROUTE_FILE" "health.health" "$ROUTE_FILE handler references the health controller action"
assert_contains "$ROUTE_FILE" "auth" "$ROUTE_FILE has an auth config key"
assert_contains "$ROUTE_FILE" "false" "$ROUTE_FILE marks the route as public (auth: false)"

echo ""
echo "--- Controller: 200 OK path (DB reachable) ---"
assert_contains "$CONTROLLER_FILE" "\"ok\"" "$CONTROLLER_FILE returns status \"ok\" when healthy"

echo ""
echo "--- Controller: 503 degraded path (DB unreachable), per contracts/api.md ---"
assert_contains "$CONTROLLER_FILE" "503" "$CONTROLLER_FILE sets HTTP 503 on the degraded path"
assert_contains "$CONTROLLER_FILE" "degraded" "$CONTROLLER_FILE returns status \"degraded\" when unhealthy"
assert_contains "$CONTROLLER_FILE" "reason" "$CONTROLLER_FILE includes a reason field on the degraded path"

echo ""
echo "--- Controller: actually probes the database connection ---"
assert_contains "$CONTROLLER_FILE" "strapi.db.connection" "$CONTROLLER_FILE probes strapi.db.connection"
assert_contains "$CONTROLLER_FILE" "try" "$CONTROLLER_FILE wraps the DB probe in a try/catch"
assert_contains "$CONTROLLER_FILE" "catch" "$CONTROLLER_FILE catches DB probe failures"

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
