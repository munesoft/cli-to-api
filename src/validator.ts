import { RouteConfig } from './types';
import { logger } from './utils/logger';

// Characters that are dangerous in shell contexts
const DANGEROUS_CHARS = /[;&|`$<>\\()\n\r\t{}[\]!#]/;

// Allowed: alphanumeric, dash, underscore, dot, slash (for paths), colon, @, +, =, comma, space
const SAFE_VALUE_RE = /^[a-zA-Z0-9\-_./:@+=, ]+$/;

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Sanitizes a single CLI argument value.
 * Throws if injection patterns detected.
 */
export function sanitizeValue(value: string, paramName: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`Param "${paramName}" must be a string`, paramName);
  }

  if (value.length > 512) {
    throw new ValidationError(`Param "${paramName}" exceeds max length of 512`, paramName);
  }

  if (DANGEROUS_CHARS.test(value)) {
    logger.warn(`Blocked injection attempt on param "${paramName}": ${value.slice(0, 50)}`);
    throw new ValidationError(
      `Param "${paramName}" contains disallowed characters`,
      paramName
    );
  }

  if (!SAFE_VALUE_RE.test(value)) {
    throw new ValidationError(
      `Param "${paramName}" contains invalid characters`,
      paramName
    );
  }

  return value.trim();
}

/**
 * Validates that a param name is in the allowed list for this route.
 */
export function validateParamName(name: string, route: RouteConfig): boolean {
  if (!route.params || route.params.length === 0) {
    return false;
  }
  return route.params.includes(name);
}

/**
 * Builds safe CLI args array from request params.
 * Maps: { limit: '10', format: 'json' } -> ['--limit', '10', '--format', 'json']
 */
export function buildSafeArgs(
  params: Record<string, string>,
  route: RouteConfig
): string[] {
  const args: string[] = [];
  const prefix = route.flagStyle === 'single' ? '-' : '--';

  for (const [key, value] of Object.entries(params)) {
    // Whitelist check
    if (!validateParamName(key, route)) {
      throw new ValidationError(`Param "${key}" is not allowed for this route`, key);
    }

    // Sanitize key (param name from config — still validate)
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
      throw new ValidationError(`Invalid param name format: "${key}"`, key);
    }

    const sanitized = sanitizeValue(String(value), key);

    // Boolean flags: ?verbose=true -> --verbose
    if (sanitized === 'true') {
      args.push(`${prefix}${key}`);
    } else if (sanitized === 'false') {
      // skip false booleans — most CLIs work this way
    } else {
      args.push(`${prefix}${key}`, sanitized);
    }
  }

  return args;
}

/**
 * Loads and validates the config file structure.
 */
export function validateConfig(raw: unknown): asserts raw is { routes: RouteConfig[] } {
  if (typeof raw !== 'object' || raw === null) {
    throw new ValidationError('Config must be a JSON object');
  }

  const cfg = raw as Record<string, unknown>;

  if (!Array.isArray(cfg['routes'])) {
    throw new ValidationError('Config must have a "routes" array');
  }

  for (const [i, route] of (cfg['routes'] as unknown[]).entries()) {
    if (typeof route !== 'object' || route === null) {
      throw new ValidationError(`Route[${i}] must be an object`);
    }

    const r = route as Record<string, unknown>;

    if (typeof r['route'] !== 'string' || !r['route'].startsWith('/')) {
      throw new ValidationError(`Route[${i}].route must be a string starting with /`);
    }

    if (typeof r['command'] !== 'string' || r['command'].trim() === '') {
      throw new ValidationError(`Route[${i}].command must be a non-empty string`);
    }

    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    if (!validMethods.includes(String(r['method']).toUpperCase())) {
      throw new ValidationError(
        `Route[${i}].method must be one of: ${validMethods.join(', ')}`
      );
    }

    if (r['params'] !== undefined && !Array.isArray(r['params'])) {
      throw new ValidationError(`Route[${i}].params must be an array`);
    }

    if (r['timeout'] !== undefined) {
      const t = Number(r['timeout']);
      if (isNaN(t) || t < 100 || t > 300000) {
        throw new ValidationError(
          `Route[${i}].timeout must be between 100ms and 300000ms`
        );
      }
    }
  }
}
