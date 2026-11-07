import http from 'node:http';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const port = Number(process.env.MARITIME_PORT ?? 4300);
const sessions = new Map();
const json = (res, code, body, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(body)); };
http.createServer(async (req, res) => {
  try {
    if (req.url === '/health') return json(res, 200, { status: 'ready' });
    if (req.url === '/auth/session' && req.method === 'POST') {
      const session = crypto.randomUUID(); sessions.set(session, new Map());
      return json(res, 200, { session }, { 'set-cookie': `maritime_session=${session}; Path=/; HttpOnly; SameSite=Strict` });
    }
    const session = /(?:^|; )maritime_session=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
    const bookings = sessions.get(session);
    if (!bookings) return json(res, 401, { error: 'Demo session required' });
    if (req.url === '/api/bookings/sync' && req.method === 'POST') {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 4096) return json(res, 413, { error: 'Payload too large' }); }
      const input = JSON.parse(body);
      if (![input.id, input.vessel, input.port].every(value => typeof value === 'string' && value.length > 0 && value.length < 128)) return json(res, 400, { error: 'Invalid booking' });
      const existing = bookings.get(input.id);
      const booking = existing ?? { id: input.id, vessel: input.vessel, port: input.port, status: 'synced' };
      bookings.set(input.id, booking); return json(res, 200, { booking, duplicate: Boolean(existing) });
    }
    if (req.url === '/api/bookings') return json(res, 200, { bookings: [...bookings.values()] });
    if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(await fs.readFile(new URL('./index.html', import.meta.url))); }
    json(res, 404, { error: 'Not found' });
  } catch { json(res, 400, { error: 'Invalid request' }); }
}).listen(port, '127.0.0.1', () => console.log(`maritime-ready http://127.0.0.1:${port}`));
