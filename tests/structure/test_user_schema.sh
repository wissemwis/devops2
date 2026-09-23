#!/bin/bash

cd "$(git rev-parse --show-toplevel)"

node - <<'EOF'
const fs = require('fs');
const EXT = 'backend/src/extensions/users-permissions/content-types/user/schema.json';
const NATIVE = './backend/node_modules/@strapi/plugin-users-permissions/dist/server/content-types/user/index.js';

let total = 0;
let passed = 0;
function check(ok, msg, detail) {
  total += 1;
  if (ok) {
    passed += 1;
    console.log(`✓ PASS: ${msg}`);
  } else {
    console.log(`✗ FAIL: ${msg}`);
    if (detail) console.log(`  ${detail}`);
  }
}

let ext = null;
try {
  ext = JSON.parse(fs.readFileSync(EXT, 'utf8'));
} catch (e) {
  check(false, `${EXT} is valid JSON`, e.message);
}
let native = null;
try {
  native = require(require('path').resolve(NATIVE)).__require();
} catch (e) {
  check(false, 'installed plugin native User schema can be loaded', e.message);
}

if (ext && native) {
  const extAttrs = ext.attributes || {};
  for (const [name, def] of Object.entries(native.attributes)) {
    check(
      JSON.stringify(extAttrs[name]) === JSON.stringify(def),
      `native attribute "${name}" copied identically`,
      `expected ${JSON.stringify(def)}, got ${JSON.stringify(extAttrs[name])}`,
    );
  }
  check(extAttrs.role && extAttrs.role.type === 'relation', 'role is the native relation, not an enum (T007 removed)');
  check(
    JSON.stringify(extAttrs.nom) === JSON.stringify({ type: 'string', required: true }),
    'nom is a required string',
    `got ${JSON.stringify(extAttrs.nom)}`,
  );
  const allowed = new Set([...Object.keys(native.attributes), 'nom']);
  const extra = Object.keys(extAttrs).filter((k) => !allowed.has(k));
  check(extra.length === 0, 'no attribute beyond the native ones and nom', `extra: ${extra.join(', ')}`);
}

console.log('');
console.log('=== Test Results ===');
console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
if (passed === total) {
  console.log('');
  console.log('✓ All tests passed!');
  process.exit(0);
}
console.log('');
console.log('✗ Some tests failed');
process.exit(1);
EOF
