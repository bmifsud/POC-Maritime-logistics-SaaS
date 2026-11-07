import { request, type FullConfig } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error('Maritime baseURL is required');
  const api = await request.newContext({ baseURL });
  try {
    const response = await api.post('/auth/session');
    if (!response.ok()) throw new Error(`Unable to create local demo session: ${response.status()}`);
    const cookies = (await response.json()) as { session: string };
    const statePath = path.resolve(import.meta.dirname, '.auth/maritime.json');
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, JSON.stringify({ cookies: [{ name: 'maritime_session', value: cookies.session, domain: '127.0.0.1', path: '/' }], origins: [] }, null, 2));
  } finally {
    await api.dispose();
  }
}
