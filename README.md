# archon-cli

A local-first terminal coding assistant. Everything runs on your machine — no cloud APIs, no telemetry.

**Stack:**
- **[SearXNG](https://searxng.org)** — self-hosted web search at `localhost:8080`, provides real-time grounding context
- **[Ollama](https://ollama.ai)** — local LLM inference at `localhost:11434`
- **[pi](https://pi.dev)** — terminal coding agent that reads, edits, and commits your files

## How it works

```
archon ask --search "fix CORS in Express"
      │
      ▼
1. SearXNG (localhost:8080) → JSON search results
      │
      ▼
2. archon formats top-N snippets as a Markdown context block
      │
      ▼
3. Injected into Ollama chat  --- or ---  pi context-footer extension
      │
      ▼
4. pi + Ollama → grounded, web-informed code edits
```

When used with `--pi --search`, archon installs a pi extension that automatically fires SearXNG searches and injects results as a context footer before every pi turn — so pi sees live web knowledge without you having to do anything.

## Quick Start

```bash
# 1. Start services
ollama serve
docker compose up -d    # SearXNG at localhost:8080

# 2. Install archon
cp .env.example .env    # set ARCHON_MODEL to your preferred model
npm install
npm run build
npm link

# 3. Install the pi search extension (one-time)
archon install-extension

# 4. Use it
archon ask "how do I parse TOML in TypeScript?"
archon ask --search "fix ECONNRESET in Node.js"
archon chat                       # plain Ollama REPL
archon chat --pi                  # pi coding agent
archon chat --pi --search         # pi with live SearXNG grounding
archon pi-task -i "add zod validation" -f src/auth.ts
archon pi-task -i "refactor to async/await" -f src/db.ts --search
archon models                     # list available Ollama models
```

## Commands

| Command | Description |
|---|---|
| `archon ask "<prompt>"` | One-shot answer from Ollama |
| `archon ask --search "<prompt>"` | SearXNG grounding → Ollama answer |
| `archon chat` | Interactive Ollama REPL (persistent history) |
| `archon chat --pi` | Launch pi coding agent (interactive TUI) |
| `archon chat --pi --search` | pi with live SearXNG grounding via extension |
| `archon pi-task -i "<instruction>" -f <file>` | pi print-mode task on a specific file |
| `archon pi-task ... --search` | Same, with SearXNG context prepended |
| `archon install-extension` | Install `~/.pi/extensions/archon-search.mjs` |
| `archon models` | List locally available Ollama models |

## Pi Extension

`archon install-extension` writes `~/.pi/extensions/archon-search.mjs` — a pi extension that:

- **Auto-searches** on every turn when your message contains coding keywords (`fix`, `error`, `api`, `install`, etc.)
- **Injects results** as a Markdown context footer before pi processes your message
- **Registers a `web_search` tool** that pi can call itself mid-task when it needs up-to-date information
- **Sets a system prompt** telling pi to prefer grounded search results over training knowledge

The trigger keyword list is configurable via `ARCHON_SEARCH_TRIGGER` in your `.env`.

## Configuration

Copy `.env.example` to `.env` and adjust as needed:

```env
ARCHON_OLLAMA_HOST=http://localhost:11434
ARCHON_MODEL=qwen2.5-coder:7b

ARCHON_SEARXNG_URL=http://localhost:8080
ARCHON_SEARCH_TOP_N=5
ARCHON_SEARCH_CATEGORIES=general,it

# Regex - turns that match trigger an auto-search in chat/extension
ARCHON_SEARCH_TRIGGER=fix|error|how|latest|version|docs|api|package|import|install|crash|undefined|null|cannot|failed
```

## Requirements

| Requirement | Install |
|---|---|
| Node.js 20+ | [nodejs.org](https://nodejs.org) |
| Ollama | `curl -fsSL https://ollama.ai/install.sh \| sh` |
| pi coding agent | `npm i -g @oh-my-pi/pi-tui` |
| Docker | [docker.com](https://docker.com) (for SearXNG) |

Recommended models: `qwen2.5-coder:7b`, `qwen2.5-coder:14b`, `deepseek-coder-v2:16b`

```bash
ollama pull qwen2.5-coder:7b
```

## Project Structure

```
archon-cli/
├── src/
│   ├── cli.ts          # Commander entry-point - all commands
│   ├── config.ts       # Env var config with typed defaults
│   ├── searxng.ts      # SearXNG HTTP client + result formatter
│   ├── llm.ts          # Ollama streaming chat + model listing
│   ├── pi.ts           # Pi launcher, print-mode runner, extension installer
│   └── ui.ts           # chalk + marked-terminal helpers
├── searxng/
│   └── settings.yml    # SearXNG config (JSON API enabled)
├── docker-compose.yml  # SearXNG container
└── .env.example
```
