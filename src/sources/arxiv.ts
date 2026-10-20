import { XMLParser } from "fast-xml-parser";
import { fetchText, spacing } from "../http.js";

const API = "https://export.arxiv.org/api/query";
// arXiv's API terms ask for no more than one request every 3 seconds.
const throttle = spacing(3000);

export interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  summary: string;
  categories: string[];
  primaryCategory: string;
  published: string;
  updated: string;
  absUrl: string;
  pdfUrl: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  isArray: (name) => ["entry", "author", "category", "link"].includes(name),
});

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

/**
 * Search arXiv. `query` is free text (matched against all fields); `categories`
 * like ["cs.AI", "cs.LG"] are OR-ed together and AND-ed with the query.
 */
export async function searchPapers(opts: {
  query?: string;
  categories?: string[];
  sort: "submitted" | "relevance" | "updated";
  limit: number;
}): Promise<ArxivPaper[]> {
  const parts: string[] = [];
  if (opts.query?.trim()) {
    // AND the words together; arXiv's default for bare space-separated terms is too loose.
    const terms = opts.query.trim().split(/\s+/).map((t) => `all:${t}`).join(" AND ");
    parts.push(`(${terms})`);
  }
  if (opts.categories?.length) {
    parts.push(`(${opts.categories.map((c) => `cat:${c}`).join(" OR ")})`);
  }
  if (!parts.length) parts.push("cat:cs.AI");

  const sortBy = { submitted: "submittedDate", relevance: "relevance", updated: "lastUpdatedDate" }[opts.sort];
  const params = new URLSearchParams({
    search_query: parts.join(" AND "),
    sortBy,
    sortOrder: "descending",
    max_results: String(opts.limit),
  });

  const xml = await fetchText(`${API}?${params}`, { retries: 4, baseDelayMs: 3000, throttle });
  const feed = parser.parse(xml).feed;
  const entries: any[] = feed?.entry ?? [];

  return entries.map((e) => {
    const links: any[] = e.link ?? [];
    const absUrl = links.find((l) => l["@rel"] === "alternate")?.["@href"] ?? clean(e.id);
    const pdfUrl = links.find((l) => l["@title"] === "pdf")?.["@href"] ?? absUrl.replace("/abs/", "/pdf/");
    return {
      id: clean(e.id).replace(/^https?:\/\/arxiv\.org\/abs\//, ""),
      title: clean(e.title),
      authors: (e.author ?? []).map((a: any) => clean(a.name)),
      summary: clean(e.summary),
      categories: (e.category ?? []).map((c: any) => c["@term"]),
      primaryCategory: e["arxiv:primary_category"]?.["@term"] ?? "",
      published: clean(e.published),
      updated: clean(e.updated),
      absUrl,
      pdfUrl,
    };
  });
}
