// .pi/extensions/archon-search.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

/** Bounded TTL cache (FIFO eviction). Avoids npm deps so Pi can load this from ~/.pi/agent/extensions/. */
function createTtlCache<K, V>(max: number, ttlMs: number) {
  const store = new Map<K, { value: V; expiresAt: number }>();
  return {
    get(key: K): V | undefined {
      const e = store.get(key);
      if (!e) return undefined;
      if (Date.now() >= e.expiresAt) {
        store.delete(key);
        return undefined;
      }
      return e.value;
    },
    set(key: K, value: V): void {
      if (store.size >= max && !store.has(key)) {
        const oldest = store.keys().next().value as K | undefined;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
  };
}

const OLLAMA_HOST = process.env.ARCHON_OLLAMA_HOST ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.ARCHON_MODEL ?? "mistral:7b";
const SEARXNG_URL = process.env.ARCHON_SEARXNG_URL ?? "http://localhost:8080";
const SEARCH_TOP_N_RAW = parseInt(process.env.ARCHON_SEARCH_TOP_N ?? "5", 10);
const SEARCH_TOP_N =
  Number.isFinite(SEARCH_TOP_N_RAW) && SEARCH_TOP_N_RAW > 0 ? SEARCH_TOP_N_RAW : 5;
const SEARCH_CATEGORIES = process.env.ARCHON_SEARCH_CATEGORIES ?? "general,it";
const REWRITE_QUERY = (process.env.ARCHON_REWRITE_QUERY ?? "true") !== "false";
const REWRITE_TIMEOUT_MS = parseInt(process.env.ARCHON_REWRITE_TIMEOUT ?? "3000", 10);
const SEARCH_TIMEOUT_MS = parseInt(process.env.ARCHON_SEARCH_TIMEOUT ?? "10000", 10);
const MAX_RETRIES = parseInt(process.env.ARCHON_MAX_RETRIES ?? "2", 10);

const searchCache = createTtlCache<string, Awaited<ReturnType<typeof searchWeb>>>(
  100,
  5 * 60 * 1000,
);

const rewriteCache = createTtlCache<string, string>(50, 30 * 60 * 1000);

async function rewriteQuery(input: string): Promise<string> {
  if (!REWRITE_QUERY) return input;

  const cacheKey = input.toLowerCase().trim();
  const cached = rewriteCache.get(cacheKey);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REWRITE_TIMEOUT_MS);

    const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        prompt:
          `Convert this coding question into a short web search query.\n` +
          `Rules: max 8 words, no quotes, no punctuation, keep libraries/framework names.\n\n` +
          `Question: ${input}\n\nSearch query:`,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return input;
    const data = (await res.json()) as { response?: string };
    const rewritten = data.response?.trim() || input;
    rewriteCache.set(cacheKey, rewritten);
    return rewritten;
  } catch {
    return input;
  }
}

async function searchWithRetry(query: string, retries = MAX_RETRIES): Promise<Awaited<ReturnType<typeof searchWeb>>> {
  const cacheKey = `${query}|${SEARCH_CATEGORIES}|${SEARCH_TOP_N}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await searchWeb(query);
      searchCache.set(cacheKey, result);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

async function searchWeb(query: string) {
  const url = new URL("/search", SEARXNG_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("categories", SEARCH_CATEGORIES);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: controller.signal,
  });

  clearTimeout(timeout);

  if (!res.ok) {
    throw new Error(`SearXNG error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      snippet?: string;
    }>;
  };

  return (data.results ?? []).slice(0, SEARCH_TOP_N).map((r, i) => ({
    index: i + 1,
    title: r.title ?? "(no title)",
    url: r.url ?? "",
    content: (r.content ?? r.snippet ?? "").trim(),
  }));
}

function formatResults(
  results: Awaited<ReturnType<typeof searchWeb>>,
  query: string,
) {
  if (results.length === 0) return `No results found for: ${query}`;

  return [
    `Search query: ${query}`,
    "",
    ...results.map((r) => `[${r.index}] ${r.title}\n${r.url}\n${r.content}`),
  ].join("\n\n");
}

export default function archonSearch(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      ctx.ui.setStatus("archon-search", "web_search ready");
    }
  });

  pi.on("tool_execution_start", async (event, ctx) => {
    if (event.toolName === "web_search" && ctx.hasUI) {
      ctx.ui.setStatus("archon-search", "searching...");
    }
  });

  pi.on("tool_execution_end", async (event, ctx) => {
    if (event.toolName === "web_search" && ctx.hasUI) {
      ctx.ui.setStatus("archon-search", "web_search ready");
    }
  });

  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the web via local SearXNG for up-to-date docs, package info, API references, and error fixes.",
    promptSnippet:
      "Use web_search when you need current documentation, package versions, breaking changes, or error solutions.",
    promptGuidelines: [
      "Prefer web_search for current library APIs and version-sensitive questions.",
      "Search before guessing when debugging unfamiliar errors.",
      "Use concise technical queries.",
    ],
    parameters: Type.Object({
      query: Type.String({
        description: "Natural language search request or technical query",
      }),
    }),
    async execute(_toolCallId, params, _signal, onUpdate, _ctx) {
      onUpdate?.({
        content: [{ type: "text", text: "Rewriting query..." }],
        details: {},
      });

      const rewritten = await rewriteQuery(params.query);

      onUpdate?.({
        content: [
          { type: "text", text: `Searching SearXNG for: ${rewritten}` },
        ],
        details: {},
      });

      const results = await searchWithRetry(rewritten);
      const text = formatResults(results, rewritten);

      return {
        content: [{ type: "text", text }],
        details: {
          originalQuery: params.query,
          rewrittenQuery: rewritten,
          resultCount: results.length,
          results,
        },
      };
    },
  });
}
