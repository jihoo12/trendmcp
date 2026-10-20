import { fetchJson, mapLimit } from "../http.js";

const FIREBASE = "https://hacker-news.firebaseio.com/v0";
const ALGOLIA = "https://hn.algolia.com/api/v1";

export type HnFeed = "top" | "new" | "best" | "ask" | "show";

export interface HnStory {
  id: number;
  title: string;
  url: string | null;
  hnUrl: string;
  points: number;
  comments: number;
  author: string;
  postedAt: string;
}

export interface HnComment {
  author: string;
  text: string;
  postedAt: string;
  replies: HnComment[];
}

interface FirebaseItem {
  id: number;
  type?: string;
  by?: string;
  time?: number;
  title?: string;
  url?: string;
  text?: string;
  score?: number;
  descendants?: number;
  kids?: number[];
  deleted?: boolean;
  dead?: boolean;
}

interface AlgoliaHit {
  objectID: string;
  title: string | null;
  url: string | null;
  points: number | null;
  num_comments: number | null;
  author: string;
  created_at: string;
}

const hnLink = (id: number | string) => `https://news.ycombinator.com/item?id=${id}`;
const isoFromUnix = (t?: number) => (t ? new Date(t * 1000).toISOString() : "");

export async function getStories(feed: HnFeed, limit: number): Promise<HnStory[]> {
  const ids = await fetchJson<number[]>(`${FIREBASE}/${feed}stories.json`);
  const items = await mapLimit(ids.slice(0, limit), 10, (id) =>
    fetchJson<FirebaseItem | null>(`${FIREBASE}/item/${id}.json`),
  );
  return items
    .filter((it): it is FirebaseItem => !!it && !it.deleted && !it.dead)
    .map((it) => ({
      id: it.id,
      title: it.title ?? "",
      url: it.url ?? null,
      hnUrl: hnLink(it.id),
      points: it.score ?? 0,
      comments: it.descendants ?? 0,
      author: it.by ?? "",
      postedAt: isoFromUnix(it.time),
    }));
}

export async function searchStories(
  query: string,
  opts: { sort: "relevance" | "date"; limit: number; minPoints?: number; daysBack?: number },
): Promise<HnStory[]> {
  const endpoint = opts.sort === "date" ? "search_by_date" : "search";
  const filters: string[] = [];
  if (opts.minPoints) filters.push(`points>=${opts.minPoints}`);
  if (opts.daysBack) filters.push(`created_at_i>=${Math.floor(Date.now() / 1000) - opts.daysBack * 86400}`);
  const params = new URLSearchParams({ query, tags: "story", hitsPerPage: String(opts.limit) });
  if (filters.length) params.set("numericFilters", filters.join(","));

  const res = await fetchJson<{ hits: AlgoliaHit[] }>(`${ALGOLIA}/${endpoint}?${params}`);
  return res.hits.map((h) => ({
    id: Number(h.objectID),
    title: h.title ?? "",
    url: h.url,
    hnUrl: hnLink(h.objectID),
    points: h.points ?? 0,
    comments: h.num_comments ?? 0,
    author: h.author,
    postedAt: h.created_at,
  }));
}

/** Fetch a story (or Ask HN post) with its top-level comments and a few levels of replies. */
export async function getItemWithComments(
  id: number,
  opts: { maxComments: number; depth: number },
): Promise<{ story: HnStory; text: string | null; comments: HnComment[] }> {
  const item = await fetchJson<FirebaseItem | null>(`${FIREBASE}/item/${id}.json`);
  if (!item) throw new Error(`HN item ${id} not found`);

  const loadComments = async (ids: number[], depth: number, max: number): Promise<HnComment[]> => {
    const kids = await mapLimit(ids.slice(0, max), 10, (k) =>
      fetchJson<FirebaseItem | null>(`${FIREBASE}/item/${k}.json`),
    );
    return mapLimit(
      kids.filter((k): k is FirebaseItem => !!k && !k.deleted && !k.dead),
      5,
      async (k) => ({
        author: k.by ?? "",
        text: htmlToText(k.text ?? ""),
        postedAt: isoFromUnix(k.time),
        // Fewer replies the deeper we go, to keep output bounded.
        replies: depth > 1 && k.kids?.length ? await loadComments(k.kids, depth - 1, Math.max(2, Math.floor(max / 3))) : [],
      }),
    );
  };

  return {
    story: {
      id: item.id,
      title: item.title ?? "",
      url: item.url ?? null,
      hnUrl: hnLink(item.id),
      points: item.score ?? 0,
      comments: item.descendants ?? 0,
      author: item.by ?? "",
      postedAt: isoFromUnix(item.time),
    },
    text: item.text ? htmlToText(item.text) : null,
    comments: item.kids?.length ? await loadComments(item.kids, opts.depth, opts.maxComments) : [],
  };
}

/** HN comment bodies are lightly formatted HTML; flatten to readable text. */
function htmlToText(html: string): string {
  return html
    .replace(/<p>/g, "\n\n")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>.*?<\/a>/g, "$1")
    .replace(/<\/?(i|b|code|pre)>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .trim();
}
