import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pruneReports } from './retention.mjs';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
test('controller enforces origin/session and serves safe dashboard', async () => {
 const child = spawn(process.execPath, [new URL('./controller.mjs', import.meta.url).pathname], { env: { ...process.env, MARITIME_CONTROLLER_PORT: '4401' } });
 try {
  await Promise.race([once(child.stdout, 'data'), new Promise((_, reject) => setTimeout(() => reject(Error('startup timeout')), 5000).unref())]);
  const base = 'http://127.0.0.1:4401';
  const page = await fetch(base); assert.equal(page.status, 200);
  const html = await page.text(); assert.match(html, /Run maritime demo/);
  assert.equal((await fetch(base+'/api/run', { method: 'POST' })).status, 403);
  const cookie = page.headers.get('set-cookie').split(';')[0];
  const csrf = /const csrf='([^']+)'/.exec(html)[1];
  const reset = await fetch(base+'/api/reset', { method: 'POST', headers: { cookie, origin: base, 'x-csrf-token': csrf } });
  assert.equal(reset.status, 200);
  assert.equal((await fetch(base+'/reports/%2e%2e%2fpackage.json')).status, 403);
  assert.equal((await fetch(base+'/health')).status, 200);
  assert.equal((await fetch(base+'/reports/last.json')).status, 403);
  assert.equal((await fetch(base+'/api/status')).status, 401);
 } finally { child.kill('SIGTERM'); await once(child, 'exit'); }
});
test('retention deletes expired runs but preserves latest and unrelated directories', async () => {
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'maritime-retention-'));
 const expired = '11111111-1111-1111-1111-111111111111';
 const latest = '22222222-2222-2222-2222-222222222222';
 try {
  for (const name of [expired, latest, 'evidence']) { await fs.mkdir(path.join(root,name)); await fs.utimes(path.join(root,name),0,0); }
  await pruneReports(root,{preserve:[latest]});
  assert.deepEqual((await fs.readdir(root)).sort(),[latest,'evidence']);
 } finally { await fs.rm(root,{recursive:true,force:true}); }
});
