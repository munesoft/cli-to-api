import { RouteConfig } from './types';
export declare class ValidationError extends Error {
    field?: string | undefined;
    constructor(message: string, field?: string | undefined);
}
/**
 * Sanitizes a single CLI argument value.
 * Throws if injection patterns detected.
 */
export declare function sanitizeValue(value: string, paramName: string): string;
/**
 * Validates that a param name is in the allowed list for this route.
 */
export declare function validateParamName(name: string, route: RouteConfig): boolean;
/**
 * Builds safe CLI args array from request params.
 * Maps: { limit: '10', format: 'json' } -> ['--limit', '10', '--format', 'json']
 */
export declare function buildSafeArgs(params: Record<string, string>, route: RouteConfig): string[];
/**
 * Loads and validates the config file structure.
 */
export declare function validateConfig(raw: unknown): asserts raw is {
    routes: RouteConfig[];
};
//# sourceMappingURL=validator.d.ts.map