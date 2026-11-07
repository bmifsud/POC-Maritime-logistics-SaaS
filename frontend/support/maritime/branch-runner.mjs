import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { testArguments } from './test-selection.mjs';
import { repository, validateSelection } from './branches.mjs';
const [branch, revision, report, selection = 'all'] = process.argv.slice(2);
validateSelection(branch, revision);
const filter = testArguments(selection);
const checkout = await fs.mkdtemp(path.join(os.tmpdir(), 'maritime-branch-'));
const env = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C.UTF-8', GIT_TERMINAL_PROMPT: '0', LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ?? '', PLAYWRIGHT_HTML_OUTPUT_DIR: report, MARITIME_DEMO: '1' };
async function execute(command, args, cwd, timeout) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit', shell: false });
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`${command} timed out`)); }, timeout);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)); });
  });
}
process.on('SIGTERM', () => { console.error('Run interrupted; temporary checkout requires cleanup:', checkout); process.exit(143); });
try {
  console.log('STAGE preparing', branch, revision);
  await execute('git', ['init', checkout], checkout, 10000);
  await execute('git', ['fetch', '--depth=1', repository, `refs/heads/${branch}`], checkout, 30000);
  const head = (await fs.readFile(path.join(checkout, '.git/FETCH_HEAD'), 'utf8')).split(/\s+/)[0];
  if (head !== revision) throw new Error('Branch moved since selection; refresh branches and retry');
  await execute('git', ['checkout', '--detach', revision], checkout, 10000);
  // Git objects are read-only; make the private checkout removable on restricted filesystems.
  await execute('chmod', ['-R', 'u+w', path.join(checkout, '.git')], checkout, 10000);
  const frontend = path.join(checkout, 'frontend');
  const manifest = JSON.parse(await fs.readFile(path.join(frontend, 'package.json'), 'utf8'));
  if (!manifest.scripts?.['test:maritime:demo']) throw new Error('Selected revision has no maritime demo command');
  console.log('STAGE installing');
  await execute('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], frontend, 240000);
  console.log('STAGE testing');
  await execute('npm', ['run', 'test:maritime:demo', ...filter], frontend, 120000);
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  // Coreutils removal also supports restricted Android-backed filesystems where Node unlink fails.
  try { await execute('rm', ['-rf', '--', checkout], os.tmpdir(), 30000); }
  catch (error) { console.error('Checkout cleanup failed:', error.message); process.exitCode = 1; }
}
