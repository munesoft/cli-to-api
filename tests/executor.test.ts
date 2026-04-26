import { executeCommand, dryRun } from '../src/executor';
import { RouteConfig } from '../src/types';

const echoRoute: RouteConfig = {
  route: '/echo',
  command: 'echo',
  method: 'GET',
  params: ['message'],
};

const failRoute: RouteConfig = {
  route: '/fail',
  command: 'false', // always exits 1
  method: 'GET',
  params: [],
};

const timeoutRoute: RouteConfig = {
  route: '/slow',
  command: 'sleep 10',
  method: 'GET',
  params: [],
  timeout: 200,
};

const jsonRoute: RouteConfig = {
  route: '/json',
  command: 'echo',
  method: 'GET',
  params: ['msg'],
  parseOutputAsJson: true,
};

describe('executeCommand', () => {
  it('executes a valid command and captures stdout', async () => {
    const result = await executeCommand(echoRoute, ['hello world'], 'test-1');
    expect(result.success).toBe(true);
    expect(result.output).toBe('hello world');
    expect(result.exitCode).toBe(0);
    expect(result.error).toBeNull();
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.requestId).toBe('test-1');
  }, 10000);

  it('returns success: false on non-zero exit', async () => {
    const result = await executeCommand(failRoute, [], 'test-2');
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
  }, 10000);

  it('handles timeout by killing the process', async () => {
    const result = await executeCommand(timeoutRoute, [], 'test-3');
    // Process should be killed — exit code non-zero or success false
    expect(result.success).toBe(false);
    expect(result.durationMs).toBeGreaterThanOrEqual(150);
  }, 5000);

  it('captures args passed as separate array elements', async () => {
    const result = await executeCommand(echoRoute, ['--message', 'safe output'], 'test-4');
    expect(result.success).toBe(true);
    expect(result.output).toContain('safe output');
  }, 10000);

  it('returns error when binary not found', async () => {
    const badRoute: RouteConfig = {
      route: '/bad',
      command: 'this_binary_does_not_exist_xyz',
      method: 'GET',
      params: [],
    };
    const result = await executeCommand(badRoute, [], 'test-5');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  }, 10000);

  it('attempts to parse JSON output when parseOutputAsJson: true', async () => {
    // echo outputs a plain string — should stay as string since not valid JSON start
    const result = await executeCommand(jsonRoute, ['--msg', 'hello'], 'test-6');
    expect(result.success).toBe(true);
  }, 10000);
});

describe('dryRun', () => {
  it('returns command and args without executing', () => {
    const preview = dryRun(echoRoute, ['--message', 'test']);
    expect(preview.command).toBe('echo');
    expect(preview.args).toEqual(['--message', 'test']);
  });

  it('splits multi-word base command', () => {
    const route: RouteConfig = {
      route: '/stripe/customers',
      command: 'stripe customers list',
      method: 'GET',
      params: ['limit'],
    };
    const preview = dryRun(route, ['--limit', '10']);
    expect(preview.command).toBe('stripe');
    expect(preview.args).toEqual(['customers', 'list', '--limit', '10']);
  });
});
