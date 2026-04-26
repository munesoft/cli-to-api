export interface RouteConfig {
  route: string;
  command: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: string[];
  description?: string;
  timeout?: number;           // ms, default 30000
  flagStyle?: 'double' | 'single'; // -- or -
  parseOutputAsJson?: boolean;
  tags?: string[];            // for OpenAPI grouping
  env?: Record<string, string>; // extra env vars to inject
}

export interface AppConfig {
  routes: RouteConfig[];
  server?: {
    port?: number;
    host?: string;
    basePath?: string;
  };
  security?: {
    apiKey?: string;
    rateLimitWindowMs?: number;
    rateLimitMax?: number;
  };
  logging?: {
    level?: 'error' | 'warn' | 'info' | 'debug';
    requests?: boolean;
  };
}

export interface ExecutionResult {
  success: boolean;
  output: string | Record<string, unknown> | unknown[];
  error: string | null;
  exitCode: number;
  durationMs: number;
  requestId: string;
}

export interface ParsedArgs {
  baseCommand: string;
  args: string[];
}
