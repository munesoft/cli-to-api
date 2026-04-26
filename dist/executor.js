"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCommand = executeCommand;
exports.dryRun = dryRun;
const child_process_1 = require("child_process");
const uuid_1 = require("uuid");
const strip_ansi_1 = __importDefault(require("strip-ansi"));
const logger_1 = require("./utils/logger");
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_CONCURRENT = 20;
let activeExecutions = 0;
/**
 * Attempts to parse stdout as JSON. Returns parsed object or original string.
 */
function maybeParseJson(output) {
    const trimmed = output.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('['))
        return trimmed;
    try {
        return JSON.parse(trimmed);
    }
    catch {
        return trimmed;
    }
}
/**
 * Splits a base command string into [executable, ...baseArgs].
 * E.g. "stripe customers list" -> ["stripe", "customers", "list"]
 */
function parseBaseCommand(command) {
    const parts = command.trim().split(/\s+/);
    const [bin, ...baseArgs] = parts;
    return [bin, baseArgs];
}
/**
 * Core executor: safely spawns a command with args using spawn() — never exec().
 * Each arg is passed as a discrete array element, preventing shell injection.
 */
async function executeCommand(route, userArgs, requestId = (0, uuid_1.v4)()) {
    if (activeExecutions >= MAX_CONCURRENT) {
        logger_1.logger.warn('Max concurrent executions reached', { requestId });
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
    logger_1.logger.info(`Executing: ${bin} ${allArgs.join(' ')}`, { requestId });
    activeExecutions++;
    const start = Date.now();
    return new Promise((resolve) => {
        const stdoutChunks = [];
        const stderrChunks = [];
        // spawn with shell: false is the default — this is the security guarantee
        const child = (0, child_process_1.spawn)(bin, allArgs, {
            shell: false, // NEVER shell: true
            env: {
                ...process.env,
                ...(route.env ?? {}),
            },
            timeout,
        });
        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            logger_1.logger.warn(`Command timed out after ${timeout}ms`, { requestId });
        }, timeout);
        child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
        child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
        child.on('error', (err) => {
            clearTimeout(timer);
            activeExecutions--;
            const durationMs = Date.now() - start;
            logger_1.logger.error(`Spawn error: ${err.message}`, { requestId });
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
            const rawStdout = (0, strip_ansi_1.default)(Buffer.concat(stdoutChunks).toString('utf8'));
            const rawStderr = (0, strip_ansi_1.default)(Buffer.concat(stderrChunks).toString('utf8'));
            const exitCode = code ?? -1;
            const success = exitCode === 0;
            const output = route.parseOutputAsJson
                ? maybeParseJson(rawStdout)
                : rawStdout.trim();
            logger_1.logger.info(`Command finished (exit ${exitCode}) in ${durationMs}ms`, { requestId });
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
function dryRun(route, userArgs) {
    const [bin, baseArgs] = parseBaseCommand(route.command);
    return { command: bin, args: [...baseArgs, ...userArgs] };
}
//# sourceMappingURL=executor.js.map