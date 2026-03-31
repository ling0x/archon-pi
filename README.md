# archon-pi

A [pi coding agent](https://github.com/mariozechner/pi-coding-agent) extension that gives pi a `web_search` tool powered by a local [SearXNG](https://searxng.github.io/searxng/) instance. Queries are optionally rewritten into tighter search terms via [Ollama](https://ollama.com/) before hitting SearXNG.

## What this repo is

- **A pi extension** — the main artifact is `.pi/extensions/archon-search.ts`
- **A SearXNG Docker config** — `docker-compose.yml` + `searxng/` for a local search instance
- **Optional helper code** in `src/` — not required to use the extension

## Prerequisites

- [Ollama](https://ollama.com/) running locally
- [Docker](https://www.docker.com/) (for SearXNG)
- [pi coding agent](https://github.com/mariozechner/pi-coding-agent) installed

## Setup

### 1. Start Ollama

```bash
ollama serve
ollama pull qwen2.5-coder:7b
```

### 2. Start SearXNG

```bash
docker compose up -d
```

SearXNG will be available at `http://localhost:8080`.

### 3. Install the extension

Copy the extension to pi's extensions directory:

```bash
# Global (all projects)
mkdir -p ~/.pi/agent/extensions
cp .pi/extensions/archon-search.ts ~/.pi/agent/extensions/archon-search.ts

# Or project-local (this project only)
mkdir -p .pi/extensions
# (already present if you cloned this repo)
```

Pi auto-discovers extensions from `~/.pi/agent/extensions/` and project-local `.pi/extensions/` directories.

### 4. Run pi

```bash
pi --model ollama/qwen2.5-coder:7b
```

The `web_search` tool will be registered automatically when pi starts.

## Configuration

All settings are controlled via environment variables (copy `.env.example` to `.env`):

| Variable | Default | Description |
|---|---|---|
| `ARCHON_OLLAMA_HOST` | `http://localhost:11434` | Ollama API base URL |
| `ARCHON_MODEL` | `qwen2.5-coder:7b` | Model used for query rewriting |
| `ARCHON_SEARXNG_URL` | `http://localhost:8080` | SearXNG instance URL |
| `ARCHON_SEARCH_TOP_N` | `5` | Number of results to return |
| `ARCHON_SEARCH_CATEGORIES` | `general,it` | SearXNG search categories |
| `ARCHON_REWRITE_QUERY` | `true` | Rewrite queries via Ollama before searching |

## How it works

1. Pi calls `web_search` with a natural-language query
2. If `ARCHON_REWRITE_QUERY=true`, the query is sent to Ollama's `/api/generate` endpoint to be condensed into a short, precise search string (max 8 words)
3. The rewritten query hits SearXNG's JSON API
4. The top `ARCHON_SEARCH_TOP_N` results are returned to pi as formatted text

## Extension API events

The extension hooks into three pi lifecycle events:

- `session_start` — sets a status indicator in the pi UI
- `tool_execution_start` — shows "searching..." while a search is in progress
- `tool_execution_end` — resets the status indicator when done

## Project structure

```
.
├── .pi/
│   └── extensions/
│       └── archon-search.ts   # The pi extension (main artifact)
├── searxng/                   # SearXNG configuration
├── src/                       # Optional helper code
├── docker-compose.yml         # SearXNG Docker setup
├── .env.example               # Environment variable reference
└── README.md
```
