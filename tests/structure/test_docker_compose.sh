#!/bin/bash

# Test script to verify docker-compose.yml per T010
# (plan.md Constraints, Principe III — Infrastructure as Code et
# Reproductibilité; research.md § Déploiement V1: "docker-compose.yml (T010)
# reste utilisé pour le développement local"; quickstart.md "Démarrage
# local"/"Nettoyage": `docker compose up -d db` / `docker compose down -v`
# must keep working)
#
# Behavioural, not grep-only: builds a throwaway .env from the real
# .env.example, asks Docker Compose itself to resolve docker-compose.yml
# (`docker compose config --format json`), and asserts on the *parsed
# model* Compose actually produces (services, images, healthchecks,
# depends_on conditions, ports, env var wiring) via python3. Also checks
# the raw YAML for secret literals (Principe IV).

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

cd "$(git rev-parse --show-toplevel)"

COMPOSE_FILE="docker-compose.yml"

echo "=== Testing docker-compose.yml (T010) ==="
echo ""

echo "--- Prerequisites ---"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    pass "Docker Compose (v2 plugin) is installed"
else
    fail "Docker Compose (v2 plugin) is installed" "'docker compose version' failed"
    echo ""
    echo "=== Test Results ==="
    echo "Total: $test_count | Passed: $pass_count | Failed: $fail_count"
    echo "✗ Cannot continue without Docker Compose"
    exit 1
fi

assert_file_exists "$COMPOSE_FILE" "$COMPOSE_FILE exists at repository root"
assert_file_exists ".env.example" ".env.example exists (used to build a throwaway env for config resolution)"

if [ ! -f "$COMPOSE_FILE" ] || [ ! -f ".env.example" ]; then
    echo ""
    echo "=== Test Results ==="
    echo "Total: $test_count | Passed: $pass_count | Failed: $fail_count"
    echo "✗ Cannot continue without $COMPOSE_FILE and .env.example"
    exit 1
fi

# --- Resolve the compose model the way Docker itself would, from a
#     throwaway env file built from .env.example (never the real .env). ---
TMP_ENV=$(mktemp)
TMP_JSON=$(mktemp)
TMP_ERR=$(mktemp)
cleanup() { rm -f "$TMP_ENV" "$TMP_JSON" "$TMP_ERR"; }
trap cleanup EXIT

cp .env.example "$TMP_ENV"

echo ""
echo "--- Compose file parses and resolves (docker compose config) ---"
if docker compose -f "$COMPOSE_FILE" --env-file "$TMP_ENV" config --format json >"$TMP_JSON" 2>"$TMP_ERR"; then
    pass "docker compose config resolves $COMPOSE_FILE against a throwaway .env.example-based env"
else
    fail "docker compose config resolves $COMPOSE_FILE against a throwaway .env.example-based env" "$(cat "$TMP_ERR")"
    echo ""
    echo "=== Test Results ==="
    echo "Total: $test_count | Passed: $pass_count | Failed: $fail_count"
    echo "✗ Cannot continue: compose config did not resolve"
    exit 1
fi

# $1 = python boolean expression over `data` (the parsed compose JSON), $2 = message
check_model() {
    if python3 -c "
import json, sys
with open('$TMP_JSON') as f:
    data = json.load(f)
sys.exit(0 if ($1) else 1)
" 2>/dev/null; then
        pass "$2"
    else
        fail "$2" "Expression: $1"
    fi
}

echo ""
echo "--- Services present (db, backend, frontend — no extras, YAGNI) ---"
check_model "set(data['services'].keys()) == {'db', 'backend', 'frontend'}" \
    "exactly the services db, backend, frontend are declared"

echo ""
echo "--- db service (PostgreSQL) ---"
check_model "data['services']['db']['image'].startswith('postgres:')" \
    "db uses the official postgres image, pinned to a major version"
check_model "data['services']['db'].get('healthcheck', {}).get('test') and 'pg_isready' in ' '.join(data['services']['db']['healthcheck']['test'])" \
    "db has a pg_isready healthcheck"
check_model "any(v.get('type') == 'volume' for v in data['services']['db'].get('volumes', []))" \
    "db persists data on a named volume (not a bind mount)"
check_model "any(str(p.get('published')) == '5432' for p in data['services']['db'].get('ports', []))" \
    "db publishes 5432 to the host (native backend / quickstart connects to it)"

echo ""
echo "--- backend service (Strapi, Node 20, bind-mounted source) ---"
check_model "data['services']['backend']['image'] == 'node:20'" \
    "backend runs the official node:20 image (no custom Dockerfile in T010)"
check_model "any(v.get('type') == 'bind' and v.get('target') == '/app' for v in data['services']['backend'].get('volumes', []))" \
    "backend bind-mounts its source directory into the container"
check_model "any(v.get('type') == 'volume' and v.get('target') == '/app/node_modules' for v in data['services']['backend'].get('volumes', []))" \
    "backend keeps container node_modules off the host tree (named/anonymous volume over /app/node_modules)"
check_model "'develop' in ' '.join(data['services']['backend'].get('command') or [])" \
    "backend command starts the Strapi dev server (npm run develop)"
check_model "data['services']['backend']['environment'].get('DATABASE_CLIENT') == 'postgres'" \
    "backend sets DATABASE_CLIENT=postgres"
check_model "data['services']['backend']['environment'].get('DATABASE_HOST') == 'db'" \
    "backend sets DATABASE_HOST=db"
check_model "data['services']['backend']['environment'].get('DATABASE_URL', '__missing__') == ''" \
    "backend neutralises DATABASE_URL (empty) so DATABASE_HOST=db is not overridden by database.ts's connectionString precedence"
check_model "data['services']['backend'].get('depends_on', {}).get('db', {}).get('condition') == 'service_healthy'" \
    "backend depends_on db with condition service_healthy"
check_model "any(str(p.get('published')) == '1337' for p in data['services']['backend'].get('ports', []))" \
    "backend publishes 1337"
hc="$(python3 -c "
import json
with open('$TMP_JSON') as f:
    data = json.load(f)
t = data['services']['backend'].get('healthcheck', {}).get('test', [])
print(' '.join(t))
")"
if echo "$hc" | grep -q "1337" && echo "$hc" | grep -q "/health"; then
    pass "backend healthcheck probes GET /health on port 1337"
else
    fail "backend healthcheck probes GET /health on port 1337" "healthcheck test was: $hc"
fi

echo ""
echo "--- frontend service (Next.js, Node 20, bind-mounted source) ---"
check_model "data['services']['frontend']['image'] == 'node:20'" \
    "frontend runs the official node:20 image (no custom Dockerfile in T010)"
check_model "any(v.get('type') == 'bind' and v.get('target') == '/app' for v in data['services']['frontend'].get('volumes', []))" \
    "frontend bind-mounts its source directory into the container"
check_model "any(v.get('type') == 'volume' and v.get('target') == '/app/node_modules' for v in data['services']['frontend'].get('volumes', []))" \
    "frontend keeps container node_modules off the host tree"
check_model "'dev' in ' '.join(data['services']['frontend'].get('command') or [])" \
    "frontend command starts the Next.js dev server (npm run dev)"
check_model "'backend' in data['services']['frontend'].get('depends_on', {})" \
    "frontend depends_on backend"
check_model "any(str(p.get('published')) == '3000' for p in data['services']['frontend'].get('ports', []))" \
    "frontend publishes 3000"
check_model "'localhost:1337' in data['services']['frontend']['environment'].get('NEXT_PUBLIC_API_BASE_URL', '')" \
    "frontend NEXT_PUBLIC_API_BASE_URL points at the backend as the browser sees it (http://localhost:1337)"

echo ""
echo "--- YAGNI: no extra services, profiles, or prod overrides ---"
check_model "'profiles' not in data" "no top-level 'profiles' key"
check_model "len(data['services']) == 3" "no services beyond db, backend, frontend"

echo ""
echo "--- Principe IV: no secret literal in the raw YAML (only \${...} references or explicit empty) ---"
TMP_PY=$(mktemp --suffix=.py)
cat >"$TMP_PY" <<'PYEOF'
import re
import sys

compose_file = sys.argv[1]

SECRETISH = re.compile(r"(PASSWORD|SECRET|SALT|_KEY|KEYS|JWT|TOKEN)", re.IGNORECASE)
KEYVAL = re.compile(r"^\s*[\"']?([A-Za-z0-9_]+)[\"']?\s*:\s*(.*)$")

bad = []
with open(compose_file) as f:
    for lineno, line in enumerate(f, start=1):
        stripped = line.split("#", 1)[0]
        m = KEYVAL.match(stripped)
        if not m:
            continue
        key, value = m.group(1), m.group(2).strip()
        if not SECRETISH.search(key):
            continue
        # value must be an interpolation, empty, or absent (mapping/omitted)
        v = value.strip().strip('"').strip("'")
        if v == "" or v.startswith("${") or v.startswith("%"):
            continue
        bad.append((lineno, key, value))

if bad:
    for lineno, key, value in bad:
        sys.stderr.write(f"{lineno}: {key}: {value}\n")
    sys.exit(1)
sys.exit(0)
PYEOF
if python3 "$TMP_PY" "$COMPOSE_FILE" 2>"$TMP_ERR"; then
    pass "no secret-looking key in $COMPOSE_FILE has a literal (non-\${...}, non-empty) value"
else
    fail "no secret-looking key in $COMPOSE_FILE has a literal (non-\${...}, non-empty) value" "$(cat "$TMP_ERR")"
fi
rm -f "$TMP_PY"

echo ""
echo "--- .env.example documents every variable docker-compose.yml needs ---"
COMPOSE_VARS=$(grep -vE '^\s*#' "$COMPOSE_FILE" | grep -oE '\$\{[A-Z0-9_]+\}' | sed -E 's/\$\{|\}//g' | sort -u)
missing=""
for var in $COMPOSE_VARS; do
    if ! grep -q "^${var}=" .env.example; then
        missing="$missing $var"
    fi
done
if [ -z "$missing" ]; then
    pass ".env.example documents every \${VAR} referenced by $COMPOSE_FILE"
else
    fail ".env.example documents every \${VAR} referenced by $COMPOSE_FILE" "Missing:$missing"
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
