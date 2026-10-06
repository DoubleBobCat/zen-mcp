import type { SearchEngine } from "../types.js";

const ENGINE_URLS: Record<SearchEngine, (query: string, page: number) => string> = {
  google: (query, page) => `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${(page - 1) * 10}`,
  bing: (query, page) => `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${(page - 1) * 10 + 1}`,
  duckduckgo: (query, page) => `https://noai.duckduckgo.com/?q=${encodeURIComponent(query)}&ia=web${page > 1 ? `&s=${(page - 1) * 30}` : ""}`,
  arxiv: (query, page) => `https://arxiv.org/search/?query=${encodeURIComponent(query)}&searchtype=all&abstracts=show&order=-announced_date_first&size=50&page=${page}`,
  bioarxiv: (query, page) => `https://www.biorxiv.org/search/${encodeURIComponent(query).replace(/%20/g, "+")}?page=${page}`,
  pubmed: (query, page) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}&page=${page}`,
  google_scholar: (query, page) => `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}&start=${(page - 1) * 10}`,
};

export function buildSearchUrl(
  engine: SearchEngine,
  query: string,
  page = 1,
): string {
  if (!ENGINE_URLS[engine]) throw new Error(`Unsupported search engine: ${engine}`);
  if (!query.trim()) throw new Error("Search query cannot be empty");
  if (!Number.isInteger(page) || page < 1) throw new Error("Search page must be a positive integer");
  return ENGINE_URLS[engine](query, page);
}

export function resolveSearchUrl(
  options: { engine?: SearchEngine; query?: string; page?: number; searchUrl?: string },
): { engine: SearchEngine | "custom"; query: string; page: number; searchUrl: string } {
  const page = options.page ?? 1;
  if (!Number.isInteger(page) || page < 1) throw new Error("Search page must be a positive integer");

  if (options.searchUrl) {
    const query = options.query ?? "";
    const template = options.searchUrl;
    const resolved = template
      .replaceAll("{query}", encodeURIComponent(query))
      .replaceAll("{page}", String(page));
    let parsed: URL;
    try {
      parsed = new URL(resolved);
    } catch {
      throw new Error(`Invalid search URL: ${template}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Search URL must use http: or https:");
    }
    if (template.includes("{query}") && !query.trim()) {
      throw new Error("query is required when searchUrl contains {query}");
    }
    return { engine: "custom", query, page, searchUrl: resolved };
  }

  if (!options.engine) throw new Error("Either engine or searchUrl must be provided");
  if (!options.query?.trim()) throw new Error("query is required for built-in search engines");
  return {
    engine: options.engine,
    query: options.query,
    page,
    searchUrl: buildSearchUrl(options.engine, options.query, page),
  };
}
