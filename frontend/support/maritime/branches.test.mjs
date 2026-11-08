import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSelection } from './branches.mjs';
test('only approved branch names and full immutable revisions are accepted', () => {
  assert.doesNotThrow(() => validateSelection('main', 'a'.repeat(40)));
  for (const branch of ['--upload-pack=evil', 'main;touch /tmp/x', '../main', 'untrusted']) assert.throws(() => validateSelection(branch, 'a'.repeat(40)));
  for (const revision of ['', 'HEAD', 'abc123', '-option']) assert.throws(() => validateSelection('main', revision));
});
