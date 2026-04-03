# archon-pi

A [pi coding agent](https://github.com/mariozechner/pi-coding-agent) extension that gives pi
a `web_search` tool powered by a local
[SearXNG](https://searxng.github.io/searxng/) instance. Queries are rewritten
into tighter search terms via [Ollama](https://ollama.com/) before hitting
SearXNG.

## How it works

1. Pi calls `web_search` with a natural-language query
2. The query is sent to Ollama's `/api/generate` to be condensed into a short,
   precise search string (max 8 words)
3. The rewritten query hits SearXNG's JSON API
4. The top N results are returned to pi as formatted Markdown

The extension also hooks `session_start`, `tool_execution_start`, and
`tool_execution_end` to show live status in the pi UI.

## Prerequisites

- [Ollama](https://ollama.com/) running locally
- [Docker](https://www.docker.com/) (for SearXNG)
- [pi coding agent](https://github.com/mariozechner/pi-coding-agent) installed
  (`npm i -g @mariozechner/pi-coding-agent`; provides the `pi` CLI)

## Setup

### 1. Start Ollama

```bash
ollama serve
ollama pull qwen3-coder-next:latest
ollama pull mistral:7b
```

### 2. Start SearXNG

```bash
docker compose up -d
```

SearXNG will be available at `http://localhost:8080`.

### 3. Install the extension

```bash
# Global — available in all pi sessions
mkdir -p ~/.pi/agent/extensions
cp .pi/extensions/archon-search.ts ~/.pi/agent/extensions/archon-search.ts

# Project-local — only active when pi runs in this directory
# (already present if you cloned this repo)
```

Pi auto-discovers extensions from `~/.pi/agent/extensions/` and from
`.pi/extensions/` in the current working directory.

### 4. Run pi

```bash
pi --model ollama/qwen3-coder-next:latest
```

The `web_search` tool is registered automatically on session start.

## Configuration

Copy `.env.example` to `.env` and adjust as needed. All variables are optional —
the defaults work out of the box. Pi does not load `.env` files automatically, so
either `export` the variables in your shell, or start pi with something like
`set -a && source .env && set +a && pi` (bash).

| Variable                   | Default                  | Description                                    |
| -------------------------- | ------------------------ | ---------------------------------------------- |
| `ARCHON_OLLAMA_HOST`       | `http://localhost:11434` | Ollama API base URL                            |
| `ARCHON_MODEL`             | `mistral:7b`             | Model used for query rewriting                 |
| `ARCHON_SEARXNG_URL`       | `http://localhost:8080`  | SearXNG instance URL                           |
| `ARCHON_SEARCH_TOP_N`      | `5`                      | Number of results to inject                    |
| `ARCHON_SEARCH_CATEGORIES` | `general,it`             | SearXNG search categories                      |
| `ARCHON_REWRITE_QUERY`     | `true`                   | Use Ollama to rewrite queries before searching |

## Project structure

```
.
├── .pi/
│   └── extensions/
│       └── archon-search.ts   # The pi extension
├── searxng/                   # SearXNG Docker configuration
├── docker-compose.yml         # Spins up a local SearXNG instance
├── .env.example               # Environment variable reference
└── README.md
```
