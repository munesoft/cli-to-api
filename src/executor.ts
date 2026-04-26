import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import stripAnsi from 'strip-ansi';
import { ExecutionResult, RouteConfig } from './types';
import { logger } from './utils/logger';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_CONCURRENT = 20;

let activeExecutions = 0;

/**
 * Attempts to parse stdout as JSON. Returns parsed object or original string.
 */
function maybeParseJson(output: string): string | Record<string, unknown> | unknown[] {
  const trimmed = output.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return trimmed;
  try {
    return JSON.parse(trimmed) as Record<string, unknown> | unknown[];
  } catch {
    return trimmed;
  }
}

/**
 * Splits a base command string into [executable, ...baseArgs].
 * E.g. "stripe customers list" -> ["stripe", "customers", "list"]
 */
function parseBaseCommand(command: string): [string, string[]] {
  const parts = command.trim().split(/\s+/);
  const [bin, ...baseArgs] = parts;
  return [bin, baseArgs];
}

/**
 * Core executor: safely spawns a command with args using spawn() — never exec().
 * Each arg is passed as a discrete array element, preventing shell injection.
 */
export async function executeCommand(
  route: RouteConfig,
  userArgs: string[],
  requestId = uuidv4()
): Promise<ExecutionResult> {
  if (activeExecutions >= MAX_CONCURRENT) {
    logger.warn('Max concurrent executions reached', { requestId });
    return {
      success: false,
      output: '',
      error: 'Server busy: too many concurrent executions',
      exitCode: 503,
      durationMs: 0,
      requestId,
    };
  }

  const timeout = route.timeout ?? DEFAULT_TIMEOUT_MS;
  const [bin, baseArgs] = parseBaseCommand(route.command);
  const allArgs = [...baseArgs, ...userArgs];

  logger.info(`Executing: ${bin} ${allArgs.join(' ')}`, { requestId });

  activeExecutions++;
  const start = Date.now();

  return new Promise((resolve) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    // spawn with shell: false is the default — this is the security guarantee
    const child = spawn(bin, allArgs, {
      shell: false,          // NEVER shell: true
      env: {
        ...process.env,
        ...(route.env ?? {}),
      },
      timeout,
    });

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      logger.warn(`Command timed out after ${timeout}ms`, { requestId });
    }, timeout);

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('error', (err) => {
      clearTimeout(timer);
      activeExecutions--;
      const durationMs = Date.now() - start;
      logger.error(`Spawn error: ${err.message}`, { requestId });

      resolve({
        success: false,
        output: '',
        error: `Failed to start command: ${err.message}`,
        exitCode: -1,
        durationMs,
        requestId,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      activeExecutions--;
      const durationMs = Date.now() - start;

      const rawStdout = stripAnsi(Buffer.concat(stdoutChunks).toString('utf8'));
      const rawStderr = stripAnsi(Buffer.concat(stderrChunks).toString('utf8'));
      const exitCode = code ?? -1;
      const success = exitCode === 0;

      const output = route.parseOutputAsJson
        ? maybeParseJson(rawStdout)
        : rawStdout.trim();

      logger.info(`Command finished (exit ${exitCode}) in ${durationMs}ms`, { requestId });

      resolve({
        success,
        output,
        error: rawStderr.trim() || null,
        exitCode,
        durationMs,
        requestId,
      });
    });
  });
}

/**
 * Dry-run: returns what would be executed without running it.
 */
export function dryRun(
  route: RouteConfig,
  userArgs: string[]
): { command: string; args: string[] } {
  const [bin, baseArgs] = parseBaseCommand(route.command);
  return { command: bin, args: [...baseArgs, ...userArgs] };
}
