import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { AppConfig } from './types';
import { buildRouter } from './router';
import { validateConfig } from './validator';
import { generateOpenApiSpec } from './utils/openapi';
import { createLogger } from './utils/logger';

export interface ServerOptions {
  dryRunMode?: boolean;
  version?: string;
}

export function createApp(config: AppConfig, opts: ServerOptions = {}): Application {
  validateConfig(config);

  const logLevel = config.logging?.level ?? 'info';
  const logger = createLogger(logLevel);
  const app = express();

  // ── Security headers ──────────────────────────────────────────────────────
  app.use(helmet());
  app.disable('x-powered-by');

  // ── Body parsing ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  // ── Request logging ───────────────────────────────────────────────────────
  if (config.logging?.requests !== false) {
    app.use(
      morgan('[:date[iso]] :method :url :status :response-time ms - :res[content-length]', {
        stream: { write: (msg) => logger.http(msg.trim()) },
      })
    );
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const rateLimitWindowMs = config.security?.rateLimitWindowMs ?? 60_000;
  const rateLimitMax = config.security?.rateLimitMax ?? 60;

  app.use(
    rateLimit({
      windowMs: rateLimitWindowMs,
      max: rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: `Rate limit exceeded: max ${rateLimitMax} requests per ${rateLimitWindowMs / 1000}s`,
      },
    })
  );

  // ── API key auth ──────────────────────────────────────────────────────────
  const apiKey = config.security?.apiKey;
  if (apiKey) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Skip auth for health + docs
      if (req.path === '/health' || req.path.startsWith('/docs')) {
        return next();
      }
      const provided = req.headers['x-api-key'] ?? req.query['api_key'];
      if (provided !== apiKey) {
        return res.status(401).json({ success: false, error: 'Unauthorized: invalid API key' });
      }
      return next();
    });
  }

  // ── Health check ──────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      routes: config.routes.length,
      uptime: Math.round(process.uptime()),
      version: opts.version ?? '1.0.0',
    });
  });

  // ── OpenAPI / Swagger ─────────────────────────────────────────────────────
  const openApiSpec = generateOpenApiSpec(config, opts.version);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/openapi.json', (_req, res) => res.json(openApiSpec));

  // ── CLI routes ────────────────────────────────────────────────────────────
  app.use(buildRouter(config));

  // ── 404 ───────────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
  });

  // ── Global error handler ──────────────────────────────────────────────────
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(`Unhandled error: ${err.message}`);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  return app;
}

export interface StartResult {
  app: Application;
  close: () => Promise<void>;
  port: number;
  host: string;
}

export async function startServer(
  config: AppConfig,
  overrides: { port?: number; host?: string; apiKey?: string } = {},
  opts: ServerOptions = {}
): Promise<StartResult> {
  const logger = createLogger(config.logging?.level);

  // Apply overrides
  if (overrides.port) {
    config.server = { ...config.server, port: overrides.port };
  }
  if (overrides.host) {
    config.server = { ...config.server, host: overrides.host };
  }
  if (overrides.apiKey) {
    config.security = { ...config.security, apiKey: overrides.apiKey };
  }

  const port = config.server?.port ?? 3000;
  const host = config.server?.host ?? '0.0.0.0';

  const app = createApp(config, opts);

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const basePath = config.server?.basePath ?? '';
      logger.info(`\n🚀 cli-to-api server running`);
      logger.info(`   http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/health`);
      logger.info(`   http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/docs`);
      logger.info(`\n📡 Routes (${config.routes.length}):`);
      for (const r of config.routes) {
        logger.info(`   ${r.method.padEnd(6)} ${basePath}${r.route}`);
      }
      if (config.security?.apiKey) {
        logger.info('\n🔐 API key protection enabled');
      }

      resolve({
        app,
        port,
        host,
        close: () =>
          new Promise((res, rej) => server.close((e) => (e ? rej(e) : res()))),
      });
    });

    server.on('error', reject);
  });
}
