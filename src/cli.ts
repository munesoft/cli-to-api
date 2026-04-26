#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { startServer } from './server';
import { AppConfig } from './types';
import { validateConfig, ValidationError } from './validator';

const program = new Command();

const VERSION = '1.0.0';

function banner() {
  console.log(chalk.cyan('\n╔══════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold('  @munesoft/cli-to-api  v' + VERSION + '       ') + chalk.cyan('║'));
  console.log(chalk.cyan('║') + chalk.gray('  Turn any CLI into a REST API         ') + chalk.cyan('║'));
  console.log(chalk.cyan('╚══════════════════════════════════════╝\n'));
}

function loadConfig(configPath: string): AppConfig {
  const resolved = path.resolve(configPath);
  if (!fs.existsSync(resolved)) {
    console.error(chalk.red(`✖ Config file not found: ${resolved}`));
    console.log(chalk.yellow('  Run: npx cli-to-api init  to generate one'));
    process.exit(1);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (err) {
    console.error(chalk.red(`✖ Failed to parse config: ${String(err)}`));
    process.exit(1);
  }

  try {
    validateConfig(raw);
  } catch (err) {
    if (err instanceof ValidationError) {
      console.error(chalk.red(`✖ Invalid config: ${err.message}`));
      process.exit(1);
    }
    throw err;
  }

  return raw as AppConfig;
}

// ── start command ──────────────────────────────────────────────────────────
program
  .command('start <config>')
  .description('Start the API server from a config file')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .option('-H, --host <host>', 'Host to bind to', '0.0.0.0')
  .option('-k, --api-key <key>', 'Require this API key (X-API-Key header)')
  .option('--dry-run', 'Print what would run without starting the server')
  .action(async (configPath: string, opts) => {
    banner();
    const config = loadConfig(configPath);

    if (opts.dryRun) {
      console.log(chalk.yellow('Dry-run mode: config looks valid ✔'));
      console.log(chalk.gray(JSON.stringify(config, null, 2)));
      process.exit(0);
    }

    try {
      await startServer(
        config,
        {
          port: parseInt(opts.port, 10),
          host: opts.host,
          apiKey: opts.apiKey,
        },
        { version: VERSION }
      );
    } catch (err) {
      console.error(chalk.red(`✖ Failed to start server: ${String(err)}`));
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
    console.log(chalk.bold('Let\'s set up your first CLI → API mapping!\n'));

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'route',
        message: 'API route path (e.g. /echo):',
        default: '/echo',
        validate: (v: string) => v.startsWith('/') || 'Must start with /',
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

    const config: AppConfig = {
      routes: [
        {
          route: answers.route as string,
          command: answers.command as string,
          method: answers.method as 'GET',
          params: answers.params
            ? (answers.params as string).split(',').map((p: string) => p.trim()).filter(Boolean)
            : [],
          description: `Execute ${answers.command as string}`,
        },
      ],
      server: { port: 3000, host: '0.0.0.0' },
    };

    if (answers.apiKey) {
      config.security = { apiKey: answers.apiKeyValue as string };
    }

    const outPath = path.resolve(opts.output as string);
    fs.writeFileSync(outPath, JSON.stringify(config, null, 2));

    console.log(chalk.green(`\n✔ Config written to ${outPath}`));
    console.log(chalk.cyan(`\nStart your server:\n  npx cli-to-api start ${opts.output as string}\n`));

    const url = `http://localhost:3000${answers.route as string}`;
    console.log(chalk.gray(`Test it:\n  curl "${url}"`));
  });

// ── validate command ──────────────────────────────────────────────────────
program
  .command('validate <config>')
  .description('Validate a config file without starting the server')
  .action((configPath: string) => {
    const config = loadConfig(configPath);
    console.log(chalk.green(`✔ Config valid — ${config.routes.length} route(s) defined`));
    for (const r of config.routes) {
      console.log(chalk.gray(`  ${r.method.padEnd(6)} ${r.route}  →  ${r.command}`));
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
