import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenarios, testArguments } from './test-selection.mjs';
test('scenario selection uses only fixed patterns, not user-supplied CLI arguments', () => {
  assert.deepEqual(testArguments(), []);
  for (const id of ['offline', 'provider', 'date', 'timezone']) {
    assert.deepEqual(testArguments(id), ['--', '--grep', scenarios[id].pattern]);
  }
  for (const id of ['--config=evil', '__proto__', '../test', '']) assert.throws(() => testArguments(id));
});
