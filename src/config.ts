import 'dotenv/config';
import { resolve } from 'path';
import { homedir } from 'os';

export const config = {
  ollama: {
    host: process.env.ARCHON_OLLAMA_HOST ?? 'http://localhost:11434',
    model: process.env.ARCHON_MODEL ?? 'qwen2.5-coder:7b',
  },
  searxng: {
    url: process.env.ARCHON_SEARXNG_URL ?? 'http://localhost:8080',
    topN: parseInt(process.env.ARCHON_SEARCH_TOP_N ?? '5', 10),
    categories: process.env.ARCHON_SEARCH_CATEGORIES ?? 'general,it',
    triggerRegex: new RegExp(
      process.env.ARCHON_SEARCH_TRIGGER ??
        'fix|error|how|latest|version|docs|api|package|import|install|crash|undefined|null|cannot|failed',
      'i'
    ),
  },
  openclaw: {
    url: process.env.ARCHON_OPENCLAW_URL ?? 'http://localhost:3000',
    agent: process.env.ARCHON_OPENCLAW_AGENT ?? 'default',
  },
  pi: {
    extensionDir: resolve(homedir(), '.pi', 'extensions'),
    extensionName: 'archon-search',
  },
} as const;
