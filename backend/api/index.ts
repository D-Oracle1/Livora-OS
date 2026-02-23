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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-cron-secret,x-company-id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const expressApp = await getHandler();
    expressApp(req, res);
  } catch (err: any) {
    res.status(500).json({
      error: 'Server initialization failed',
      message: err?.message || 'Unknown error',
    });
  }
}
