import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const revision = 'a'.repeat(40);
async function fixture(t, mode = 'success') {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'branch-runner-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const bin = path.join(root, 'bin');
  const tmp = path.join(root, 'tmp');
  await fs.mkdir(bin); await fs.mkdir(tmp);
  const git = `#!/bin/sh
case "$1" in
init) mkdir -p "$2/.git" "$2/frontend"; printf '%s' '{"scripts":{"test:maritime:demo":"test"}}' > "$2/frontend/package.json" ;;
fetch) printf '%s' '${mode === 'moved' ? 'b'.repeat(40) : revision}' > .git/FETCH_HEAD ;;
esac
`;
  const npm = `#!/bin/sh
printf '%s\\n' "$*" >> '${root}/commands'
${mode === 'install-failure' ? 'exit 7' : mode === 'cancel' ? 'exec sleep 30' : 'exit 0'}
`;
  for (const [name, script] of [['git', git], ['npm', npm]]) {
    await fs.writeFile(path.join(bin, name), script, { mode: 0o700 });
  }
  const child = spawn(process.execPath, [new URL('./branch-runner.mjs', import.meta.url).pathname, 'main', revision, path.join(root, 'report')], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: tmp },
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  const done = once(child, 'close');
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  return { root, tmp, child, done, output: () => output };
}

test('successful preparation installs without lifecycle scripts and removes checkout', { timeout: 10000 }, async t => {
  const run = await fixture(t);
  assert.equal((await run.done)[0], 0, run.output());
  assert.deepEqual(await fs.readdir(run.tmp), []);
  assert.equal(await fs.readFile(path.join(run.root, 'commands'), 'utf8'), 'ci --ignore-scripts --no-audit --no-fund\nrun test:maritime:demo\n');
});
test('branch movement fails before installation and cleans checkout', { timeout: 10000 }, async t => {
  const run = await fixture(t, 'moved');
  assert.equal((await run.done)[0], 1);
  assert.match(run.output(), /Branch moved/);
  await assert.rejects(fs.access(path.join(run.root, 'commands')));
  assert.deepEqual(await fs.readdir(run.tmp), []);
});
test('installation failure skips testing and cleans checkout', { timeout: 10000 }, async t => {
  const run = await fixture(t, 'install-failure');
  assert.equal((await run.done)[0], 1);
  assert.match(run.output(), /npm exited 7/);
  assert.doesNotMatch(await fs.readFile(path.join(run.root, 'commands'), 'utf8'), /run test/);
  assert.deepEqual(await fs.readdir(run.tmp), []);
});
test('SIGTERM cancels preparation and removes temporary checkout', { timeout: 10000 }, async t => {
  const run = await fixture(t, 'cancel');
  while (!run.output().includes('STAGE installing')) await new Promise(resolve => setTimeout(resolve, 10));
  run.child.kill('SIGTERM');
  assert.equal((await run.done)[0], 143, run.output());
  assert.deepEqual(await fs.readdir(run.tmp), []);
});
