import fs from 'node:fs/promises';
import path from 'node:path';

/** Remove only expired UUID run directories; never follow symlinks or touch ADLC evidence. */
export async function pruneReports(directory, { now = Date.now(), maxAgeMs = 7 * 86400000, preserve = [] } = {}) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[0-9a-f-]{36}$/.test(entry.name) || preserve.includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    const stat = await fs.lstat(target);
    if (!stat.isSymbolicLink() && now - stat.mtimeMs > maxAgeMs) await fs.rm(target, { recursive: true });
  }
}
