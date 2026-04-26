#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const server_1 = require("./server");
const validator_1 = require("./validator");
const program = new commander_1.Command();
const VERSION = '1.0.0';
function banner() {
    console.log(chalk_1.default.cyan('\n╔══════════════════════════════════════╗'));
    console.log(chalk_1.default.cyan('║') + chalk_1.default.bold('  @munesoft/cli-to-api  v' + VERSION + '       ') + chalk_1.default.cyan('║'));
    console.log(chalk_1.default.cyan('║') + chalk_1.default.gray('  Turn any CLI into a REST API         ') + chalk_1.default.cyan('║'));
    console.log(chalk_1.default.cyan('╚══════════════════════════════════════╝\n'));
}
function loadConfig(configPath) {
    const resolved = path_1.default.resolve(configPath);
    if (!fs_1.default.existsSync(resolved)) {
        console.error(chalk_1.default.red(`✖ Config file not found: ${resolved}`));
        console.log(chalk_1.default.yellow('  Run: npx cli-to-api init  to generate one'));
        process.exit(1);
    }
    let raw;
    try {
        raw = JSON.parse(fs_1.default.readFileSync(resolved, 'utf8'));
    }
    catch (err) {
        console.error(chalk_1.default.red(`✖ Failed to parse config: ${String(err)}`));
        process.exit(1);
    }
    try {
        (0, validator_1.validateConfig)(raw);
    }
    catch (err) {
        if (err instanceof validator_1.ValidationError) {
            console.error(chalk_1.default.red(`✖ Invalid config: ${err.message}`));
            process.exit(1);
        }
        throw err;
    }
    return raw;
}
// ── start command ──────────────────────────────────────────────────────────
program
    .command('start <config>')
    .description('Start the API server from a config file')
    .option('-p, --port <number>', 'Port to listen on', '3000')
    .option('-H, --host <host>', 'Host to bind to', '0.0.0.0')
    .option('-k, --api-key <key>', 'Require this API key (X-API-Key header)')
    .option('--dry-run', 'Print what would run without starting the server')
    .action(async (configPath, opts) => {
    banner();
    const config = loadConfig(configPath);
    if (opts.dryRun) {
        console.log(chalk_1.default.yellow('Dry-run mode: config looks valid ✔'));
        console.log(chalk_1.default.gray(JSON.stringify(config, null, 2)));
        process.exit(0);
    }
    try {
        await (0, server_1.startServer)(config, {
            port: parseInt(opts.port, 10),
            host: opts.host,
            apiKey: opts.apiKey,
        }, { version: VERSION });
    }
    catch (err) {
        console.error(chalk_1.default.red(`✖ Failed to start server: ${String(err)}`));
        process.exit(1);
    }
});
// ── init command ───────────────────────────────────────────────────────────
program
    .command('init')
    .description('Interactively generate a starter config file')
    .option('-o, --output <file>', 'Output path', 'cli-to-api.config.json')
    .action(async (opts) => {
    banner();
    console.log(chalk_1.default.bold('Let\'s set up your first CLI → API mapping!\n'));
    const answers = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'route',
            message: 'API route path (e.g. /echo):',
            default: '/echo',
            validate: (v) => v.startsWith('/') || 'Must start with /',
        },
        {
            type: 'input',
            name: 'command',
            message: 'CLI command to run (e.g. echo):',
            default: 'echo',
        },
        {
            type: 'list',
            name: 'method',
            message: 'HTTP method:',
            choices: ['GET', 'POST', 'PUT', 'DELETE'],
            default: 'GET',
        },
        {
            type: 'input',
            name: 'params',
            message: 'Allowed params (comma-separated, leave blank for none):',
            default: 'message',
        },
        {
            type: 'confirm',
            name: 'apiKey',
            message: 'Enable API key protection?',
            default: false,
        },
        {
            type: 'input',
            name: 'apiKeyValue',
            message: 'Enter your API key:',
            default: `secret-${Math.random().toString(36).slice(2, 10)}`,
            when: (a) => a.apiKey,
        },
    ]);
    const config = {
        routes: [
            {
                route: answers.route,
                command: answers.command,
                method: answers.method,
                params: answers.params
                    ? answers.params.split(',').map((p) => p.trim()).filter(Boolean)
                    : [],
                description: `Execute ${answers.command}`,
            },
        ],
        server: { port: 3000, host: '0.0.0.0' },
    };
    if (answers.apiKey) {
        config.security = { apiKey: answers.apiKeyValue };
    }
    const outPath = path_1.default.resolve(opts.output);
    fs_1.default.writeFileSync(outPath, JSON.stringify(config, null, 2));
    console.log(chalk_1.default.green(`\n✔ Config written to ${outPath}`));
    console.log(chalk_1.default.cyan(`\nStart your server:\n  npx cli-to-api start ${opts.output}\n`));
    const url = `http://localhost:3000${answers.route}`;
    console.log(chalk_1.default.gray(`Test it:\n  curl "${url}"`));
});
// ── validate command ──────────────────────────────────────────────────────
program
    .command('validate <config>')
    .description('Validate a config file without starting the server')
    .action((configPath) => {
    const config = loadConfig(configPath);
    console.log(chalk_1.default.green(`✔ Config valid — ${config.routes.length} route(s) defined`));
    for (const r of config.routes) {
        console.log(chalk_1.default.gray(`  ${r.method.padEnd(6)} ${r.route}  →  ${r.command}`));
    }
});
program
    .name('cli-to-api')
    .version(VERSION)
    .description('Turn any CLI command into a REST API endpoint');
program.parse(process.argv);
if (process.argv.length < 3) {
    banner();
    program.help();
}
//# sourceMappingURL=cli.js.map