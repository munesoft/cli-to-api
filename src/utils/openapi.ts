import { AppConfig, RouteConfig } from '../types';

function buildParamSchema(paramName: string) {
  return {
    name: paramName,
    in: 'query' as const,
    required: false,
    schema: { type: 'string' as const },
    description: `Maps to --${paramName} CLI flag`,
  };
}

function buildRouteSpec(route: RouteConfig) {
  const method = route.method.toLowerCase();
  const params = (route.params ?? []).map(buildParamSchema);

  const spec: Record<string, unknown> = {
    summary: route.description ?? `Execute: ${route.command}`,
    tags: route.tags ?? ['cli'],
    parameters: [
      {
        name: 'dry_run',
        in: 'query',
        required: false,
        schema: { type: 'boolean' },
        description: 'Return command preview without executing',
      },
      ...params,
    ],
    responses: {
      '200': {
        description: 'Command executed successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                output: { oneOf: [{ type: 'string' }, { type: 'object' }, { type: 'array' }] },
                error: { type: 'string', nullable: true },
                exitCode: { type: 'integer' },
                durationMs: { type: 'integer' },
                requestId: { type: 'string', format: 'uuid' },
              },
            },
          },
        },
      },
      '400': { description: 'Validation error' },
      '401': { description: 'Unauthorized' },
      '429': { description: 'Rate limit exceeded' },
      '500': { description: 'Execution error' },
    },
  };

  if (method === 'post' || method === 'put' || method === 'patch') {
    spec['requestBody'] = {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: Object.fromEntries(
              (route.params ?? []).map((p) => [p, { type: 'string' }])
            ),
          },
        },
      },
    };
  }

  return { method, spec };
}

export function generateOpenApiSpec(config: AppConfig, version = '1.0.0') {
  const basePath = config.server?.basePath ?? '';
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of config.routes) {
    const fullPath = `${basePath}${route.route}`;
    if (!paths[fullPath]) paths[fullPath] = {};
    const { method, spec } = buildRouteSpec(route);
    paths[fullPath][method] = spec;
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'CLI-to-API',
      description: 'Auto-generated REST API from CLI commands via @munesoft/cli-to-api',
      version,
    },
    components: {
      securitySchemes: config.security?.apiKey
        ? {
            ApiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'X-API-Key',
            },
          }
        : {},
    },
    security: config.security?.apiKey ? [{ ApiKeyAuth: [] }] : [],
    paths,
  };
}
