import { Application } from 'express';
import { AppConfig } from './types';
export interface ServerOptions {
    dryRunMode?: boolean;
    version?: string;
}
export declare function createApp(config: AppConfig, opts?: ServerOptions): Application;
export interface StartResult {
    app: Application;
    close: () => Promise<void>;
    port: number;
    host: string;
}
export declare function startServer(config: AppConfig, overrides?: {
    port?: number;
    host?: string;
    apiKey?: string;
}, opts?: ServerOptions): Promise<StartResult>;
//# sourceMappingURL=server.d.ts.map