import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import net from 'node:net';
const probe = port => new Promise((resolve, reject) => {
 const server = net.createServer(); server.once('error', reject); server.listen(port, '127.0.0.1', () => server.close(resolve));
});
try {
 await fs.mkdir(new URL('../../../artifacts/', import.meta.url), { recursive: true });
 await probe(4300);
 const browser = await chromium.launch({ args: ['--no-sandbox'] }); await browser.close();
 console.log(JSON.stringify({ status: 'ready', node: process.version, browser: chromium.executablePath(), note: 'Android tunnel and physical device require separate smoke validation' }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
