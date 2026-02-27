const test = require('node:test');
const assert = require('node:assert/strict');

const { parseInitArgs } = require('./init-db');

test('parseInitArgs parses schema and non-interactive flags', () => {
  const parsed = parseInitArgs(['--schema', 'backend-api', '--non-interactive']);
  assert.equal(parsed.schema, 'backend-api');
  assert.equal(parsed.nonInteractive, true);
});
