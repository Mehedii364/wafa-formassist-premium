import 'dotenv/config';
import express, {type Request, type Response, type NextFunction} from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createCloudApiRouter} from './backend/src/routes';
import {createCloudRepository} from './backend/src/store';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const envList = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const origin of envList) origins.add(origin);

  if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
    try {
      origins.add(new URL(process.env.APP_URL).origin);
    } catch {
      // Ignore malformed APP_URL
    }
  }

  if (!IS_PROD) {
    origins.add(`http://localhost:${PORT}`);
    origins.add(`http://127.0.0.1:${PORT}`);
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }

  return origins;
}

function isAllowedOrigin(origin: string, allowed: Set<string>, reqHost: string | undefined): boolean {
  if (allowed.has(origin)) return true;
  if (reqHost) {
    try {
      const parsed = new URL(origin);
      if (parsed.host === reqHost) return true;
    } catch {
      return false;
    }
  }
  return false;
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const allowedOrigins = buildAllowedOrigins();

  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }
  app.disable('x-powered-by');

  // Strict CORS allowlist + Security headers (iframe-compatible for AI Studio preview)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );

    if (IS_PROD || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    const scriptSrc = IS_PROD
      ? "script-src 'self' https://apis.google.com https://accounts.google.com https://www.gstatic.com"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://www.gstatic.com";

    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' data: https://fonts.gstatic.com",
        "img-src 'self' data: blob: https://*.googleusercontent.com",
        "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com",
        "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://*.web.app",
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; '),
    );

    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin, allowedOrigins, req.headers.host)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    }

    if (req.method === 'OPTIONS') {
      if (origin && !isAllowedOrigin(origin, allowedOrigins, req.headers.host)) {
        res.status(403).end();
        return;
      }
      res.status(204).end();
      return;
    }

    next();
  });

  // Optional Cloud Services API (v1) backed by Cloud SQL PostgreSQL when configured
  app.use('/api/v1', createCloudApiRouter(createCloudRepository()));

  if (!IS_PROD) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
        ws: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build artifacts not found. Run npm run build first.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`WAFA FormAssist Premium server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start WAFA FormAssist server:', err instanceof Error ? err.message : err);
  process.exit(1);
});
