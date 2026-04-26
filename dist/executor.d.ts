import { ExecutionResult, RouteConfig } from './types';
/**
 * Core executor: safely spawns a command with args using spawn() — never exec().
 * Each arg is passed as a discrete array element, preventing shell injection.
 */
export declare function executeCommand(route: RouteConfig, userArgs: string[], requestId?: string): Promise<ExecutionResult>;
/**
 * Dry-run: returns what would be executed without running it.
 */
export declare function dryRun(route: RouteConfig, userArgs: string[]): {
    command: string;
    args: string[];
};
//# sourceMappingURL=executor.d.ts.map