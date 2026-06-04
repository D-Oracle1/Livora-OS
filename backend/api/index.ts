import express from 'express';

let cachedHandler: express.Express | null = null;
let initPromise: Promise<express.Express> | null = null;

async function getHandler(): Promise<express.Express> {
  if (cachedHandler) return cachedHandler;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const { configureApp } = await import('../dist/main');
        const expressApp = express();
        const { app } = await configureApp(expressApp);
        await app.init();
        cachedHandler = expressApp;
        return expressApp;
      } catch (err: any) {
        console.error('NestJS init error:', err.message, err.stack);
        initPromise = null;
        throw err;
      }
    })();
  }

  return initPromise;
}

function setCorsHeaders(req: any, res: any) {
  const origin = req.headers.origin;
  // Always reflect the request origin so credentials work; fall back to wildcard
  // for non-browser requests (curl, server-to-server).
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  if (origin) res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-cron-secret,x-company-id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: any, res: any) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Vercel Fluid Compute patches IncomingMessage.prototype with a `body` getter
  // that throws "Invalid JSON" when body-parser tries to access it synchronously.
  // Shadow it with `undefined` on this specific request instance so body-parser
  // skips the getter and reads the body from the underlying stream as normal.
  try {
    Object.defineProperty(req, 'body', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  } catch { /* already an own property — no action needed */ }

  // Wrap Express dispatch in a promise so async crashes don't produce a response-less
  // 502 from Vercel (which has no CORS headers). The timeout fires just before Vercel's
  // 60-second function limit so we can still send a CORS-enabled error response.
  await new Promise<void>((resolve) => {
    const forceClose = setTimeout(() => {
      if (!res.headersSent) {
        setCorsHeaders(req, res);
        res.status(504).json({ error: 'Gateway timeout' });
      }
      resolve();
    }, 55_000);

    res.on('finish', () => { clearTimeout(forceClose); resolve(); });
    res.on('close',  () => { clearTimeout(forceClose); resolve(); });

    getHandler()
      .then((expressApp) => { expressApp(req, res); })
      .catch((err: any) => {
        clearTimeout(forceClose);
        if (!res.headersSent) {
          setCorsHeaders(req, res);
          res.status(500).json({
            error: 'Server initialization failed',
            message: err?.message || 'Unknown error',
          });
        }
        resolve();
      });
  });
}
