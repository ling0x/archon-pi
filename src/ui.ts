import chalk from 'chalk';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

// Configure marked to render Markdown in the terminal
marked.setOptions({ renderer: new TerminalRenderer() as any });

export function banner(): void {
  console.log(
    chalk.cyan.bold('\n  ▲ archon') +
    chalk.dim(' — local coding assistant\n')
  );
}

export function renderMarkdown(md: string): void {
  process.stdout.write(marked(md) as string);
}

export function info(msg: string): void {
  console.log(chalk.dim(`  ${msg}`));
}

export function success(msg: string): void {
  console.log(chalk.green(`  ✓ ${msg}`));
}

export function warn(msg: string): void {
  console.log(chalk.yellow(`  ⚠ ${msg}`));
}

export function error(msg: string): void {
  console.error(chalk.red(`  ✖ ${msg}`));
}

export function searchHeader(query: string): void {
  console.log(chalk.cyan(`\n  🔍 Searching SearXNG for: ${chalk.bold(query)}\n`));
}

export function streamToken(token: string): void {
  process.stdout.write(token);
}

export function newline(): void {
  process.stdout.write('\n');
}
