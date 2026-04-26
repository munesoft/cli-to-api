import { sanitizeValue, buildSafeArgs, validateConfig, ValidationError } from '../src/validator';
import { RouteConfig } from '../src/types';

const baseRoute: RouteConfig = {
  route: '/test',
  command: 'echo',
  method: 'GET',
  params: ['limit', 'format', 'verbose', 'query'],
};

describe('sanitizeValue', () => {
  it('passes clean strings', () => {
    expect(sanitizeValue('hello', 'name')).toBe('hello');
    expect(sanitizeValue('10', 'limit')).toBe('10');
    expect(sanitizeValue('some-flag_value', 'flag')).toBe('some-flag_value');
  });

  it('blocks shell injection characters', () => {
    const injections = [
      '; rm -rf /',
      '$(whoami)',
      '`id`',
      '| cat /etc/passwd',
      '&& evil',
      '<(cat /etc/hosts)',
      'a\nb',
      'a\tb',
    ];
    for (const injection of injections) {
      expect(() => sanitizeValue(injection, 'param')).toThrow(ValidationError);
    }
  });

  it('blocks values over 512 chars', () => {
    expect(() => sanitizeValue('a'.repeat(513), 'x')).toThrow(ValidationError);
  });

  it('accepts 512 char value', () => {
    expect(() => sanitizeValue('a'.repeat(512), 'x')).not.toThrow();
  });
});

describe('buildSafeArgs', () => {
  it('maps params to double-dash flags', () => {
    const args = buildSafeArgs({ limit: '10', format: 'json' }, baseRoute);
    expect(args).toEqual(['--limit', '10', '--format', 'json']);
  });

  it('handles boolean true as flag only', () => {
    const args = buildSafeArgs({ verbose: 'true' }, baseRoute);
    expect(args).toEqual(['--verbose']);
  });

  it('omits boolean false params', () => {
    const args = buildSafeArgs({ verbose: 'false' }, baseRoute);
    expect(args).toEqual([]);
  });

  it('uses single dash with flagStyle: single', () => {
    const route = { ...baseRoute, flagStyle: 'single' as const };
    const args = buildSafeArgs({ limit: '5' }, route);
    expect(args).toEqual(['-limit', '5']);
  });

  it('throws on unknown params', () => {
    expect(() => buildSafeArgs({ evil: 'x' }, baseRoute)).toThrow(ValidationError);
  });

  it('throws on injection in value', () => {
    expect(() => buildSafeArgs({ limit: '; rm -rf /' }, baseRoute)).toThrow(ValidationError);
  });

  it('returns empty array for empty params', () => {
    expect(buildSafeArgs({}, baseRoute)).toEqual([]);
  });
});

describe('validateConfig', () => {
  it('accepts valid config', () => {
    const cfg = {
      routes: [{ route: '/test', command: 'echo hello', method: 'GET' }],
    };
    expect(() => validateConfig(cfg)).not.toThrow();
  });

  it('rejects non-object', () => {
    expect(() => validateConfig(null)).toThrow(ValidationError);
    expect(() => validateConfig('string')).toThrow(ValidationError);
  });

  it('rejects missing routes array', () => {
    expect(() => validateConfig({})).toThrow(ValidationError);
  });

  it('rejects route without leading slash', () => {
    const cfg = { routes: [{ route: 'noslash', command: 'echo', method: 'GET' }] };
    expect(() => validateConfig(cfg)).toThrow(ValidationError);
  });

  it('rejects invalid HTTP method', () => {
    const cfg = { routes: [{ route: '/x', command: 'echo', method: 'FETCH' }] };
    expect(() => validateConfig(cfg)).toThrow(ValidationError);
  });

  it('rejects empty command', () => {
    const cfg = { routes: [{ route: '/x', command: '', method: 'GET' }] };
    expect(() => validateConfig(cfg)).toThrow(ValidationError);
  });

  it('rejects timeout out of range', () => {
    const cfg = { routes: [{ route: '/x', command: 'echo', method: 'GET', timeout: 50 }] };
    expect(() => validateConfig(cfg)).toThrow(ValidationError);
  });
});
