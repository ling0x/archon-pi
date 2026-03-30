# archon-cli

A local-first terminal coding assistant integrating:
- **SearXNG** (self-hosted search at `localhost:8080`) for real-time web grounding
- **Ollama** (local LLM at `localhost:11434`) for inference
- **pi** coding agent for interactive CLI editing
- **OpenClaw** for background/long-running agent tasks

## Quick Start

```bash
# 1. Start services
ollama serve
docker compose up -d          # SearXNG at localhost:8080
openclaw daemon start          # optional background agent

# 2. Install archon
cp .env.example .env           # edit model name if needed
npm install
npm run build
npm link

# 3. Use it
archon ask "how do I parse TOML in TypeScript?"
archon ask --search "asyncio TaskGroup python 3.11"
archon chat                    # plain Ollama REPL
archon chat --pi               # launch pi coding agent
archon chat --pi --search      # pi with live SearXNG grounding
archon pi-task -i "add zod validation to auth.ts" -f src/auth.ts
archon openclaw "summarise my git log from today"
archon models                  # list available Ollama models
```

## Architecture

```
archon ask --search "fix CORS"
      │
      ▼
1. SearXNG (localhost:8080) → JSON results
      │
      ▼
2. Format top-N snippets as Markdown context block
      │
      ▼
3. Inject into Ollama chat OR as pi context-footer extension
      │
      ▼
4. pi + Ollama → grounded code edits
```

## Commands

| Command | Description |
|---|---|
| `archon ask "<prompt>"` | One-shot LLM answer |
| `archon ask --search "<prompt>"` | SearXNG grounding → LLM answer |
| `archon chat` | Interactive Ollama REPL |
| `archon chat --pi` | Launch pi coding agent |
| `archon chat --pi --search` | pi with SearXNG extension active |
| `archon pi-task -i "<instruction>" -f <file>` | pi print-mode task on a file |
| `archon openclaw "<task>"` | Send task to OpenClaw daemon |
| `archon models` | List available Ollama models |

## Pi Extension

Archon installs a pi extension at `~/.pi/extensions/archon-search.mjs` that:
- Fires SearXNG searches automatically when your message contains coding keywords
- Appends results as a context footer before every pi turn
- Runs a `/search <query>` tool that pi can call itself

Run `archon install-extension` after `npm link` to install it.

## Environment Variables

See `.env.example` for all options.

## Requirements

- Node.js 20+
- [Ollama](https://ollama.ai)
- [pi coding agent](https://shittycodingagent.ai): `npm i -g @oh-my-pi/pi-tui`
- [OpenClaw](https://github.com/openclaw/openclaw) (optional)
- Docker (for SearXNG)
