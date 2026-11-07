import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
export const repository = 'https://github.com/bmifsud/POC-Maritime-logistics-SaaS.git';
export const allowedBranches = ['main', 'feat/portal-branch-testing'];
export function validateSelection(branch, revision) {
  if (!allowedBranches.includes(branch) || !/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('Select an approved branch and full revision');
}
export async function listBranches() {
  const { stdout } = await exec('git', ['ls-remote', '--heads', repository, ...allowedBranches.map(name => `refs/heads/${name}`)], { timeout: 15000, maxBuffer: 65536, env: { PATH: process.env.PATH, HOME: process.env.HOME, GIT_TERMINAL_PROMPT: '0' } });
  return stdout.trim().split('\n').filter(Boolean).map(line => {
    const [revision, ref] = line.split(/\s+/);
    return { branch: ref.slice('refs/heads/'.length), revision };
  }).filter(item => allowedBranches.includes(item.branch));
}
