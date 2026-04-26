export interface RouteConfig {
    route: string;
    command: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    params?: string[];
    description?: string;
    timeout?: number;
    flagStyle?: 'double' | 'single';
    parseOutputAsJson?: boolean;
    tags?: string[];
    env?: Record<string, string>;
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
//# sourceMappingURL=types.d.ts.map