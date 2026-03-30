import { config } from './config.js';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

/**
 * Query the local SearXNG instance and return formatted results.
 */
export async function search(query: string, topN?: number): Promise<SearchResult[]> {
  const url = new URL('/search', config.searxng.url);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('categories', config.searxng.categories);

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    throw new Error(`SearXNG error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { results: Array<{
    title?: string;
    url?: string;
    content?: string;
    snippet?: string;
  }> };

  return (data.results ?? []).slice(0, topN ?? config.searxng.topN).map((r) => ({
    title: r.title ?? '(no title)',
    url: r.url ?? '',
    content: r.content ?? r.snippet ?? '',
  }));
}

/**
 * Format search results as a Markdown context block for injection.
 */
export function formatResults(results: SearchResult[]): string {
  if (results.length === 0) return '';
  const items = results.map(
    (r, i) => `**[${i + 1}] ${r.title}**\n${r.url}\n${r.content.trim()}`
  );
  return `\n\n---\n## Web Search Results (via SearXNG)\n\n${items.join('\n\n')}\n---\n`;
}

/**
 * Check if a prompt should trigger an auto-search.
 */
export function shouldSearch(prompt: string): boolean {
  return config.searxng.triggerRegex.test(prompt);
}
