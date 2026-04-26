"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const router_1 = require("./router");
const validator_1 = require("./validator");
const openapi_1 = require("./utils/openapi");
const logger_1 = require("./utils/logger");
function createApp(config, opts = {}) {
    (0, validator_1.validateConfig)(config);
    const logLevel = config.logging?.level ?? 'info';
    const logger = (0, logger_1.createLogger)(logLevel);
    const app = (0, express_1.default)();
    // ── Security headers ──────────────────────────────────────────────────────
    app.use((0, helmet_1.default)());
    app.disable('x-powered-by');
    // ── Body parsing ──────────────────────────────────────────────────────────
    app.use(express_1.default.json({ limit: '100kb' }));
    app.use(express_1.default.urlencoded({ extended: false, limit: '100kb' }));
    // ── Request logging ───────────────────────────────────────────────────────
    if (config.logging?.requests !== false) {
        app.use((0, morgan_1.default)('[:date[iso]] :method :url :status :response-time ms - :res[content-length]', {
            stream: { write: (msg) => logger.http(msg.trim()) },
        }));
    }
    // ── Rate limiting ─────────────────────────────────────────────────────────
    const rateLimitWindowMs = config.security?.rateLimitWindowMs ?? 60000;
    const rateLimitMax = config.security?.rateLimitMax ?? 60;
    app.use((0, express_rate_limit_1.default)({
        windowMs: rateLimitWindowMs,
        max: rateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            error: `Rate limit exceeded: max ${rateLimitMax} requests per ${rateLimitWindowMs / 1000}s`,
        },
    }));
    // ── API key auth ──────────────────────────────────────────────────────────
    const apiKey = config.security?.apiKey;
    if (apiKey) {
        app.use((req, res, next) => {
            // Skip auth for health + docs
            if (req.path === '/health' || req.path.startsWith('/docs')) {
                return next();
            }
            const provided = req.headers['x-api-key'] ?? req.query['api_key'];
            if (provided !== apiKey) {
                return res.status(401).json({ success: false, error: 'Unauthorized: invalid API key' });
            }
            return next();
        });
    }
    // ── Health check ──────────────────────────────────────────────────────────
    app.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            routes: config.routes.length,
            uptime: Math.round(process.uptime()),
            version: opts.version ?? '1.0.0',
        });
    });
    // ── OpenAPI / Swagger ─────────────────────────────────────────────────────
    const openApiSpec = (0, openapi_1.generateOpenApiSpec)(config, opts.version);
    app.use('/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(openApiSpec));
    app.get('/openapi.json', (_req, res) => res.json(openApiSpec));
    // ── CLI routes ────────────────────────────────────────────────────────────
    app.use((0, router_1.buildRouter)(config));
    // ── 404 ───────────────────────────────────────────────────────────────────
    app.use((_req, res) => {
        res.status(404).json({ success: false, error: 'Route not found' });
    });
    // ── Global error handler ──────────────────────────────────────────────────
    app.use((err, _req, res, _next) => {
        logger.error(`Unhandled error: ${err.message}`);
        res.status(500).json({ success: false, error: 'Internal server error' });
    });
    return app;
}
async function startServer(config, overrides = {}, opts = {}) {
    const logger = (0, logger_1.createLogger)(config.logging?.level);
    // Apply overrides
    if (overrides.port) {
        config.server = { ...config.server, port: overrides.port };
    }
    if (overrides.host) {
        config.server = { ...config.server, host: overrides.host };
    }
    if (overrides.apiKey) {
        config.security = { ...config.security, apiKey: overrides.apiKey };
    }
    const port = config.server?.port ?? 3000;
    const host = config.server?.host ?? '0.0.0.0';
    const app = createApp(config, opts);
    return new Promise((resolve, reject) => {
        const server = app.listen(port, host, () => {
            const basePath = config.server?.basePath ?? '';
            logger.info(`\n🚀 cli-to-api server running`);
            logger.info(`   http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/health`);
            logger.info(`   http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/docs`);
            logger.info(`\n📡 Routes (${config.routes.length}):`);
            for (const r of config.routes) {
                logger.info(`   ${r.method.padEnd(6)} ${basePath}${r.route}`);
            }
            if (config.security?.apiKey) {
                logger.info('\n🔐 API key protection enabled');
            }
            resolve({
                app,
                port,
                host,
                close: () => new Promise((res, rej) => server.close((e) => (e ? rej(e) : res()))),
            });
        });
        server.on('error', reject);
    });
}
//# sourceMappingURL=server.js.map