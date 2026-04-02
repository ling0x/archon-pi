import { spawnSync, spawn } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { config } from './config.js';
import { renderExtension } from './extension.js';
import { success, warn, error } from './ui.js';

/**
 * Launch pi in interactive TUI mode.
 * If searchEnabled, the archon-search extension is activated via env.
 */
export function launchPi(searchEnabled = false): void {
  const piArgs = ['--model', `ollama/${config.ollama.model}`];

  const env: NodeJS.ProcessEnv = { ...process.env };
  if (searchEnabled) {
    env.PI_EXTENSIONS = config.pi.extensionName;
    env.ARCHON_SEARXNG_URL = config.searxng.url;
    env.ARCHON_TOP_N = String(config.searxng.topN);
    env.ARCHON_SEARCH_TRIGGER = config.searxng.triggerRegex.source;
  }

  const result = spawn('pi', piArgs, {
    stdio: 'inherit',
    env,
    shell: false,
  });

  result.on('error', (err) => {
    error(`Could not launch pi: ${err.message}`);
    error('Install pi with: npm i -g @oh-my-pi/pi-tui');
  });
}

/**
 * Run pi in print (non-interactive) mode with an instruction and file.
 */
export function runPiTask(instruction: string, filePath: string, searchContext?: string): void {
  const prompt = searchContext
    ? `${searchContext}\n\nInstruction: ${instruction}`
    : instruction;

  const env: NodeJS.ProcessEnv = { ...process.env };

  const args = [
    '--model', `ollama/${config.ollama.model}`,
    '-p', prompt,
    filePath,
  ];

  const result = spawnSync('pi', args, {
    stdio: 'inherit',
    env,
    encoding: 'utf8',
  });

  if (result.error) {
    error(`pi task failed: ${result.error.message}`);
  }
}

/**
 * Install the archon-search pi extension to ~/.pi/extensions/
 * Extension source is rendered from src/extension.ts — the canonical definition.
 */
export function installExtension(): void {
  const dir = config.pi.extensionDir;
  const outPath = resolve(dir, `${config.pi.extensionName}.mjs`);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    warn(`Created extension directory: ${dir}`);
  }

  writeFileSync(outPath, renderExtension(), 'utf8');
  success(`Pi extension installed → ${outPath}`);
  success(`Activate with: archon chat --pi --search`);
}
