#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';

import { config } from './config.js';
import { search, formatResults, shouldSearch } from './searxng.js';
import { streamChat, listModels, type Message } from './llm.js';
import { launchPi, runPiTask, installExtension } from './pi.js';
import { banner, info, warn, error as uiError, searchHeader, streamToken, newline } from './ui.js';

const program = new Command();

program
  .name('archon')
  .description('Local terminal coding assistant — SearXNG + Ollama + pi')
  .version('0.1.0');

// ─── ask ──────────────────────────────────────────────────────────────────────
program
  .command('ask <prompt>')
  .description('One-shot LLM answer, optionally grounded with SearXNG')
  .option('-s, --search', 'Ground the answer with live SearXNG results')
  .option('-m, --model <model>', 'Override the Ollama model')
  .action(async (prompt: string, opts: { search?: boolean; model?: string }) => {
    banner();

    const messages: Message[] = [];

    if (opts.search) {
      searchHeader(prompt);
      const spinner = ora('Searching SearXNG…').start();
      try {
        const results = await search(prompt);
        spinner.stop();
        if (results.length > 0) {
          const ctx = formatResults(results);
          messages.push({ role: 'system', content: `You are a helpful coding assistant. Use the following web search results to inform your answer:\n${ctx}` });
          info(`Found ${results.length} results.`);
        } else {
          warn('No search results found — answering from model knowledge.');
        }
      } catch (err: unknown) {
        spinner.fail('SearXNG search failed');
        warn(err instanceof Error ? err.message : String(err));
      }
    }

    messages.push({ role: 'user', content: prompt });

    console.log();
    try {
      for await (const token of streamChat(messages, opts.model)) {
        streamToken(token);
      }
      newline();
    } catch (err: unknown) {
      uiError(`Ollama error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// ─── chat ──────────────────────────────────────────────────────────────────────
program
  .command('chat')
  .description('Interactive REPL with Ollama, or launch pi coding agent')
  .option('-p, --pi', 'Launch pi coding agent')
  .option('-s, --search', 'Enable SearXNG grounding (auto-inject context each turn)')
  .option('-m, --model <model>', 'Override the Ollama model')
  .action(async (opts: { pi?: boolean; search?: boolean; model?: string }) => {
    banner();

    if (opts.pi) {
      if (opts.search) {
        info('Launching pi with SearXNG extension active…');
        info(`Extension: ~/.pi/extensions/${config.pi.extensionName}.mjs`);
        info('Run `archon install-extension` first if not installed.');
      } else {
        info('Launching pi coding agent…');
      }
      launchPi(opts.search ?? false);
      return;
    }

    info(`Model: ${opts.model ?? config.ollama.model}`);
    if (opts.search) info('Web grounding: ON (SearXNG auto-search)');
    console.log(chalk.dim('  Type your message. Ctrl+C or empty line twice to quit.\n'));

    const history: Message[] = [];
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (q: string) => new Promise<string>((res) => rl.question(q, res));

    let emptyCount = 0;
    while (true) {
      const input = await question(chalk.cyan('you › ')).catch(() => '');

      if (!input.trim()) {
        emptyCount++;
        if (emptyCount >= 2) break;
        continue;
      }
      emptyCount = 0;

      let userContent = input.trim();

      if (opts.search && shouldSearch(userContent)) {
        const spinner = ora('SearXNG…').start();
        try {
          const results = await search(userContent);
          spinner.stop();
          if (results.length > 0) userContent += formatResults(results);
        } catch {
          spinner.fail('Search failed — continuing without grounding');
        }
      }

      history.push({ role: 'user', content: userContent });
      process.stdout.write(chalk.bold('\narchon › '));

      let full = '';
      try {
        for await (const token of streamChat(history, opts.model)) {
          streamToken(token);
          full += token;
        }
        newline();
        history.push({ role: 'assistant', content: full });
      } catch (err: unknown) {
        uiError(`\nOllama error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    rl.close();
    info('Session ended.');
  });

// ─── pi-task ───────────────────────────────────────────────────────────────────
program
  .command('pi-task')
  .description('Run a pi coding task on a file (print mode, non-interactive)')
  .requiredOption('-i, --instruction <instruction>', 'Coding instruction for pi')
  .requiredOption('-f, --file <file>', 'File to work on')
  .option('-s, --search', 'Prepend SearXNG results to the pi prompt')
  .action(async (opts: { instruction: string; file: string; search?: boolean }) => {
    banner();
    info(`File: ${opts.file}`);
    info(`Instruction: ${opts.instruction}`);

    let searchCtx: string | undefined;

    if (opts.search) {
      searchHeader(opts.instruction);
      const spinner = ora('Searching…').start();
      try {
        const results = await search(opts.instruction);
        spinner.stop();
        if (results.length > 0) {
          searchCtx = `Web search context:\n${formatResults(results)}`;
          info(`Injecting ${results.length} search results into pi prompt.`);
        }
      } catch {
        spinner.fail('Search failed — continuing without grounding');
      }
    }

    runPiTask(opts.instruction, opts.file, searchCtx);
  });

// ─── models ────────────────────────────────────────────────────────────────────
program
  .command('models')
  .description('List locally available Ollama models')
  .action(async () => {
    banner();
    const spinner = ora('Fetching models from Ollama…').start();
    try {
      const models = await listModels();
      spinner.stop();
      if (models.length === 0) {
        warn('No models found. Pull one with: ollama pull qwen2.5-coder:7b');
      } else {
        console.log(chalk.bold('\n  Available models:\n'));
        models.forEach((m) => console.log(chalk.cyan(`    • ${m}`)));
        newline();
      }
    } catch (err: unknown) {
      spinner.fail('Could not connect to Ollama');
      uiError(err instanceof Error ? err.message : String(err));
      uiError('Is Ollama running? Run: ollama serve');
      process.exit(1);
    }
  });

// ─── install-extension ─────────────────────────────────────────────────────────
program
  .command('install-extension')
  .description('Install the archon-search pi extension to ~/.pi/extensions/')
  .action(() => {
    banner();
    try {
      installExtension();
      info('Activate with: archon chat --pi --search');
      info('Or set PI_EXTENSIONS=archon-search before running pi manually.');
    } catch (err: unknown) {
      uiError(`Install failed: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parse();
