import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppConfig, RouteConfig } from './types';
import { buildSafeArgs, ValidationError } from './validator';
import { executeCommand, dryRun } from './executor';
import { logger } from './utils/logger';

function extractParams(req: Request, method: string): Record<string, string> {
  if (method === 'GET' || method === 'DELETE') {
    return req.query as Record<string, string>;
  }
  // POST/PUT/PATCH: merge body + query (query takes precedence)
  return { ...(req.body as Record<string, string>), ...(req.query as Record<string, string>) };
}

function buildRouteHandler(route: RouteConfig) {
  return async (req: Request, res: Response): Promise<void> => {
    const requestId = uuidv4();
    const isDryRun = req.query['dry_run'] === 'true' || req.query['dry_run'] === '1';

    // Remove meta params before processing
    const rawParams = extractParams(req, route.method);
    const { dry_run: _dr, ...params } = rawParams as Record<string, string>;

    try {
      const userArgs = buildSafeArgs(params, route);

      if (isDryRun) {
        const preview = dryRun(route, userArgs);
        res.json({
          dryRun: true,
          command: preview.command,
          args: preview.args,
          fullCommand: [preview.command, ...preview.args].join(' '),
          requestId,
        });
        return;
      }

      const result = await executeCommand(route, userArgs, requestId);
      const statusCode = result.success ? 200 : 500;
      res.status(statusCode).json(result);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: err.message,
          field: err.field,
          requestId,
        });
        return;
      }

      logger.error('Unexpected error in route handler', { requestId, error: String(err) });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        requestId,
      });
    }
  };
}

export function buildRouter(config: AppConfig): Router {
  const router = Router();
  const basePath = config.server?.basePath ?? '';

  for (const route of config.routes) {
    const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
    const fullPath = `${basePath}${route.route}`;
    const handler = buildRouteHandler(route);

    router[method](fullPath, handler);

    logger.info(`  ${route.method.padEnd(6)} ${fullPath}  →  ${route.command}`);
  }

  return router;
}
