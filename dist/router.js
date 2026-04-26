"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRouter = buildRouter;
const express_1 = require("express");
const uuid_1 = require("uuid");
const validator_1 = require("./validator");
const executor_1 = require("./executor");
const logger_1 = require("./utils/logger");
function extractParams(req, method) {
    if (method === 'GET' || method === 'DELETE') {
        return req.query;
    }
    // POST/PUT/PATCH: merge body + query (query takes precedence)
    return { ...req.body, ...req.query };
}
function buildRouteHandler(route) {
    return async (req, res) => {
        const requestId = (0, uuid_1.v4)();
        const isDryRun = req.query['dry_run'] === 'true' || req.query['dry_run'] === '1';
        // Remove meta params before processing
        const rawParams = extractParams(req, route.method);
        const { dry_run: _dr, ...params } = rawParams;
        try {
            const userArgs = (0, validator_1.buildSafeArgs)(params, route);
            if (isDryRun) {
                const preview = (0, executor_1.dryRun)(route, userArgs);
                res.json({
                    dryRun: true,
                    command: preview.command,
                    args: preview.args,
                    fullCommand: [preview.command, ...preview.args].join(' '),
                    requestId,
                });
                return;
            }
            const result = await (0, executor_1.executeCommand)(route, userArgs, requestId);
            const statusCode = result.success ? 200 : 500;
            res.status(statusCode).json(result);
        }
        catch (err) {
            if (err instanceof validator_1.ValidationError) {
                res.status(400).json({
                    success: false,
                    error: err.message,
                    field: err.field,
                    requestId,
                });
                return;
            }
            logger_1.logger.error('Unexpected error in route handler', { requestId, error: String(err) });
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                requestId,
            });
        }
    };
}
function buildRouter(config) {
    const router = (0, express_1.Router)();
    const basePath = config.server?.basePath ?? '';
    for (const route of config.routes) {
        const method = route.method.toLowerCase();
        const fullPath = `${basePath}${route.route}`;
        const handler = buildRouteHandler(route);
        router[method](fullPath, handler);
        logger_1.logger.info(`  ${route.method.padEnd(6)} ${fullPath}  →  ${route.command}`);
    }
    return router;
}
//# sourceMappingURL=router.js.map