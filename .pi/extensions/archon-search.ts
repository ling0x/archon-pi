// .pi/extensions/archon-search.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const OLLAMA_HOST = process.env.ARCHON_OLLAMA_HOST ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.ARCHON_MODEL ?? "mistral:7b";
const SEARXNG_URL = process.env.ARCHON_SEARXNG_URL ?? "http://localhost:8080";
const SEARCH_TOP_N_RAW = parseInt(process.env.ARCHON_SEARCH_TOP_N ?? "5", 10);
const SEARCH_TOP_N =
  Number.isFinite(SEARCH_TOP_N_RAW) && SEARCH_TOP_N_RAW > 0 ? SEARCH_TOP_N_RAW : 5;
const SEARCH_CATEGORIES = process.env.ARCHON_SEARCH_CATEGORIES ?? "general,it";
const REWRITE_QUERY = (process.env.ARCHON_REWRITE_QUERY ?? "true") !== "false";

async function rewriteQuery(input: string): Promise<string> {
  if (!REWRITE_QUERY) return input;

  try {
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
    });

    if (!res.ok) return input;
    const data = (await res.json()) as { response?: string };
    return data.response?.trim() || input;
  } catch {
    return input;
  }
}

async function searchWeb(query: string) {
  const url = new URL("/search", SEARXNG_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("categories", SEARCH_CATEGORIES);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

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

      const results = await searchWeb(rewritten);
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
