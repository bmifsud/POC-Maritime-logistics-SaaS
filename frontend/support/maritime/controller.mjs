import http from 'node:http';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { testArguments } from './test-selection.mjs';
import { listBranches, validateSelection } from './branches.mjs';
import { pruneReports } from './retention.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.resolve(root, '../artifacts/demo-runs');
await fs.mkdir(output, { recursive: true, mode: 0o700 });
const port = Number(process.env.MARITIME_CONTROLLER_PORT ?? 4400);
const sessions = new Map();
let active = null;
let last = null;
let child;
try { last = JSON.parse(await fs.readFile(path.join(output, 'last.json'), 'utf8')); } catch {}
await pruneReports(output, { preserve: last ? [last.id] : [] });
const send = (res, code, body, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers }); res.end(JSON.stringify(body)); };
const finish = async (run, code, reason) => {
  if (active !== run) return;
  run.status = code === 0 ? 'passed' : 'failed'; run.exitCode = code; run.reason = reason; run.finishedAt = new Date().toISOString();
  last = run; active = null; clearTimeout(run.timer); delete run.timer;
  await fs.writeFile(path.join(output, 'last.tmp'), JSON.stringify(run));
  await fs.rename(path.join(output, 'last.tmp'), path.join(output, 'last.json'));
};
const server = http.createServer(async (req, res) => {
 try {
  const url = new URL(req.url, 'http://localhost');
  const host = req.headers.host;
  if (!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host)) return send(res, 403, { error: 'Loopback host required' });
  const sid = /(?:^|; )demo_session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
  const session = sessions.get(sid);
  if (req.method === 'POST') {
    if (req.headers.origin !== `http://${host}` || !session || session.expires < Date.now() || req.headers['x-csrf-token'] !== session.csrf) return send(res, 403, { error: 'Session/origin validation failed; reload dashboard' });
  }
  if (url.pathname === '/health') return send(res, 200, { status: 'available', active: Boolean(active) });
  if (url.pathname === '/api/status') {
    if (!session || session.expires < Date.now()) return send(res, 401, { error: 'Reload dashboard to renew session' });
    return send(res, 200, { active: active ? { ...active, timer: undefined } : null, last });
  }
  if (url.pathname === '/api/branches' && req.method === 'GET') {
    if (!session || session.expires < Date.now()) return send(res, 401, { error: 'Session required' });
    try { return send(res, 200, { branches: await listBranches() }); } catch { return send(res, 502, { error: 'Remote branches unavailable; no stale revision substituted' }); }
  }
  if (url.pathname === '/api/run' && req.method === 'POST') {
    if (active) return send(res, 409, { error: 'Run already active', id: active.id });
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 2048) return send(res, 413, { error: 'Request too large' }); }
    let selected;
    try { selected = JSON.parse(body); validateSelection(selected.branch, selected.revision); testArguments(selected.test); } catch { return send(res, 400, { error: 'Select an approved branch and revision' }); }
    if (active) return send(res, 409, { error: 'Run already active', id: active.id });
    const id = crypto.randomUUID();
    active = { id, status: 'preparing', branch: selected.branch, revision: selected.revision };
    const report = path.join(output, id);
    try { await fs.mkdir(report); } catch { active = null; return send(res, 500, { error: 'Cannot create run directory' }); }
    const run = { id, status: 'running', startedAt: new Date().toISOString(), output: '', test: selected.test ?? 'all', branch: selected.branch, revision: selected.revision, dirty: false };
    active = run;
    child = spawn(process.execPath, [fileURLToPath(new URL('./branch-runner.mjs', import.meta.url)), selected.branch, selected.revision, report, selected.test ?? 'all'], { cwd: root, shell: false, detached: true, env: { ...process.env, PLAYWRIGHT_HTML_OUTPUT_DIR: report } });
    const append = chunk => { run.output = (run.output + chunk.toString()).slice(-24000); };
    child.stdout.on('data', append); child.stderr.on('data', append);
    child.on('error', error => { void finish(run, -1, error.message); });
    child.on('close', code => { void finish(run, code, 'process completed'); });
    run.timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} void finish(run, -1, '480 second timeout'); }, 480000);
    return send(res, 202, { id });
  }
  if (url.pathname === '/api/reset' && req.method === 'POST') {
    if (active) return send(res, 409, { error: 'Cannot reset active run' });
    last = null; await fs.rm(path.join(output, 'last.json'), { force: true }); return send(res, 200, { status: 'reset' });
  }
  if (url.pathname.startsWith('/reports/')) {
    const relative = decodeURIComponent(url.pathname.slice(9));
    if (!/^[0-9a-f-]{36}\//.test(relative)) return send(res, 403, { error: 'Run report required' });
    if (!session || session.expires < Date.now()) return send(res, 401, { error: 'Reload dashboard to renew session' });
    const target = path.resolve(output, relative);
    if (!target.startsWith(output + path.sep)) return send(res, 403, { error: 'Invalid report path' });
    const real = await fs.realpath(target);
    if (!real.startsWith(output + path.sep)) return send(res, 403, { error: 'Invalid report path' });
    res.writeHead(200, { 'content-type': target.endsWith('.html') ? 'text/html' : target.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
    return res.end(await fs.readFile(real));
  }
  if (url.pathname === '/') {
    const id = crypto.randomUUID(); const csrf = crypto.randomUUID();
    sessions.set(id, { csrf, expires: Date.now() + 3600000 });
    for (const [key, value] of sessions) if (value.expires < Date.now()) sessions.delete(key);
    const html = (await fs.readFile(new URL('./dashboard.html', import.meta.url), 'utf8')).replace('__CSRF__', csrf);
    res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store', 'set-cookie': `demo_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600` }); return res.end(html);
  }
  send(res, 404, { error: 'Not found' });
 } catch { send(res, 404, { error: 'Resource unavailable' }); }
});
const stop = () => { if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} } server.close(); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
server.listen(port, '127.0.0.1', () => console.log(`controller-ready http://127.0.0.1:${port}`));
