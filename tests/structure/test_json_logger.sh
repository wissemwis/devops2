#!/bin/bash

# Test script to verify structured JSON logging on stdout per T009
# (constitution Principe V — Observabilité; plan.md Constitution Check row V:
# "les logs applicatifs sont structurés (JSON) sur stdout"; research.md
# § Observabilité: "logs applicatifs en JSON structuré sur stdout").
#
# Beyond checking that backend/config/logger.ts exists, this script exercises
# the config for real: it transpiles logger.ts with the backend's own
# TypeScript, resolves it exactly like Strapi's config loader does (calling it
# with { env } when it exports a function), feeds it to @strapi/logger's
# createLogger with Strapi's own default ({ level: 'http', ...config }, see
# @strapi/core Strapi.registerInternalServices), logs through it in a child
# node process, and asserts on what actually lands on stdout.

set -e

test_count=0
pass_count=0
fail_count=0

pass() {
    test_count=$((test_count + 1))
    pass_count=$((pass_count + 1))
    echo "✓ PASS: $1"
}

fail() {
    test_count=$((test_count + 1))
    fail_count=$((fail_count + 1))
    echo "✗ FAIL: $1"
    if [ -n "$2" ]; then
        echo "  $2"
    fi
}

assert_file_exists() {
    if [ -f "$1" ]; then pass "$2"; else fail "$2" "Expected file: $1"; fi
}

assert_contains() {
    if [ -f "$1" ] && grep -q "$2" "$1"; then
        pass "$3"
    else
        fail "$3" "Expected '$2' in: $1"
    fi
}

cd "$(git rev-parse --show-toplevel)"

LOGGER_FILE="backend/config/logger.ts"

# Runs a snippet of logging calls against the real logger config and prints
# ONLY what the logger wrote to stdout (stderr is captured separately).
# $1 = JS statements using `logger`; remaining env vars are passed through.
run_logger() {
    local calls=$1
    (cd backend && node -e "
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const file = path.resolve('config/logger.ts');
const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
}).outputText;
const m = new Module(file, module);
m.filename = file;
m.paths = Module._nodeModulePaths(path.dirname(file));
m._compile(out, file);
let config = m.exports && m.exports.__esModule ? m.exports.default : m.exports;
if (typeof config === 'function') config = config({ env: require('@strapi/utils').env });
const logger = require('@strapi/logger').createLogger({ level: 'http', ...config });
$calls
" )
}

echo "=== Testing structured JSON logging on stdout (T009) ==="
echo ""

echo "--- File exists (Strapi 5 logger override point) ---"
assert_file_exists "$LOGGER_FILE" "$LOGGER_FILE exists"

if [ ! -d backend/node_modules ]; then
    fail "backend/node_modules is installed (needed for behavioural checks)" "Run 'npm ci' in backend/ first"
fi

echo ""
echo "--- Behaviour: an info log is exactly one JSON line on stdout ---"
set +e
info_out=$(run_logger "logger.info('t009 hello', { questionnaireId: 42 });" 2>"${TMPDIR:-/tmp}/t009_stderr")
info_rc=$?
set -e
if [ $info_rc -eq 0 ]; then
    pass "logger config loads and logs without throwing"
else
    fail "logger config loads and logs without throwing" "$(head -5 "${TMPDIR:-/tmp}/t009_stderr")"
fi

line_count=$(printf '%s' "$info_out" | grep -c . || true)
if [ "$line_count" = "1" ]; then
    pass "a single log call produces exactly one stdout line"
else
    fail "a single log call produces exactly one stdout line" "Got $line_count line(s): $info_out"
fi

check_json() {
    # $1 = log line, $2 = JS boolean expression over parsed object `o`, $3 = message
    if printf '%s' "$1" | node -e "
let s=''; process.stdin.on('data',d=>s+=d).on('end',()=>{
  let o; try { o = JSON.parse(s.trim()); } catch (e) { process.exit(1); }
  process.exit(($2) ? 0 : 1);
});" 2>/dev/null; then
        pass "$3"
    else
        fail "$3" "Line was: $1"
    fi
}

check_json "$info_out" "typeof o === 'object' && o !== null" "stdout line parses as a JSON object"
check_json "$info_out" "o.level === 'info'" "JSON has level \"info\""
check_json "$info_out" "o.message === 't009 hello'" "JSON has the logged message"
check_json "$info_out" "typeof o.timestamp === 'string' && !isNaN(Date.parse(o.timestamp))" "JSON has a parseable timestamp"
check_json "$info_out" "o.questionnaireId === 42" "structured metadata is kept as JSON fields"

# Strapi's own migration logger (@strapi/database migrations/logger) passes
# { timestamp: Date.now() } as metadata; the field must stay one consistent
# type (ISO-8601 string) so log collectors can map it.
set +e
ts_out=$(run_logger "logger.info('t009 migration', { timestamp: 1790112646488 });" 2>/dev/null)
set -e
check_json "$ts_out" "typeof o.timestamp === 'string' && /^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z\$/.test(o.timestamp)" "timestamp is always an ISO-8601 string, even when the caller passes an epoch number"

if printf '%s' "$info_out" | grep -q $'\x1b\['; then
    fail "stdout contains no ANSI color codes" "Line was: $info_out"
else
    pass "stdout contains no ANSI color codes"
fi

echo ""
echo "--- Behaviour: errors are logged as JSON with message and stack ---"
set +e
err_out=$(run_logger "logger.error(new Error('t009 boom'));" 2>/dev/null)
set -e
check_json "$err_out" "o.level === 'error'" "error log has level \"error\""
check_json "$err_out" "typeof o.message === 'string' && o.message.includes('t009 boom')" "error log keeps the error message"
check_json "$err_out" "typeof o.stack === 'string' && o.stack.includes('t009 boom')" "error log includes the stack trace as a JSON field"

echo ""
echo "--- Behaviour: Strapi's HTTP request logs (strapi::logger, level http) still emitted by default ---"
set +e
http_out=$(run_logger "logger.http('GET /health (3 ms) 200');" 2>/dev/null)
set -e
check_json "$http_out" "o.level === 'http' && o.message === 'GET /health (3 ms) 200'" "http-level request log emitted as JSON at default level"

echo ""
echo "--- Behaviour: LOG_LEVEL env var overrides the level ---"
set +e
lvl_out=$(LOG_LEVEL=warn run_logger "logger.info('t009 hidden'); logger.warn('t009 shown');" 2>/dev/null)
set -e
lvl_lines=$(printf '%s' "$lvl_out" | grep -c . || true)
if [ "$lvl_lines" = "1" ] && ! printf '%s' "$lvl_out" | grep -q "t009 hidden"; then
    pass "LOG_LEVEL=warn suppresses info logs"
else
    fail "LOG_LEVEL=warn suppresses info logs" "Got: $lvl_out"
fi
check_json "$lvl_out" "o.level === 'warn' && o.message === 't009 shown'" "LOG_LEVEL=warn still emits warn logs as JSON"

echo ""
echo "--- LOG_LEVEL documented (Principe IV: env vars documented in .env.example) ---"
assert_contains ".env.example" "^LOG_LEVEL=" ".env.example documents LOG_LEVEL"
assert_contains "backend/.env.example" "^LOG_LEVEL=" "backend/.env.example documents LOG_LEVEL"

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
