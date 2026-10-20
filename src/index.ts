#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { formatPapers, formatRepos, formatStories, formatThread } from "./format.js";
import { searchPapers } from "./sources/arxiv.js";
import { getTrending } from "./sources/github.js";
import { getItemWithComments, getStories, searchStories } from "./sources/hackernews.js";

const server = new McpServer({ name: "trendmcp", version: "1.0.0" });

const readOnly = { readOnlyHint: true, openWorldHint: true } as const;
const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

/** Turn a thrown error into a tool error result instead of a protocol error. */
async function run(fn: () => Promise<string>) {
  try {
    return text(await fn());
  } catch (err) {
    return { ...text(`Error: ${err instanceof Error ? err.message : String(err)}`), isError: true };
  }
}

const sinceLabel = { daily: "today", weekly: "this week", monthly: "this month" } as const;

server.registerTool(
  "hackernews_stories",
  {
    title: "Hacker News stories",
    description: "Get the current Hacker News front page (top), newest, best, Ask HN or Show HN stories.",
    inputSchema: {
      feed: z.enum(["top", "new", "best", "ask", "show"]).default("top"),
      limit: z.number().int().min(1).max(50).default(20),
    },
    annotations: readOnly,
  },
  ({ feed, limit }) => run(async () => formatStories(await getStories(feed, limit))),
);

server.registerTool(
  "hackernews_search",
  {
    title: "Search Hacker News",
    description:
      "Full-text search of Hacker News stories (via Algolia). Use to find discussion about a topic, product or paper.",
    inputSchema: {
      query: z.string().min(1),
      sort: z.enum(["relevance", "date"]).default("relevance"),
      days_back: z.number().int().min(1).max(3650).optional().describe("Only stories from the last N days"),
      min_points: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(50).default(20),
    },
    annotations: readOnly,
  },
  ({ query, sort, days_back, min_points, limit }) =>
    run(async () =>
      formatStories(await searchStories(query, { sort, limit, daysBack: days_back, minPoints: min_points })),
    ),
);

server.registerTool(
  "hackernews_thread",
  {
    title: "Hacker News thread",
    description: "Read a Hacker News story or Ask HN post with its top comments, to summarise what people are saying.",
    inputSchema: {
      id: z.number().int().describe("HN item id (the number in news.ycombinator.com/item?id=...)"),
      max_comments: z.number().int().min(1).max(50).default(15).describe("Top-level comments to load"),
      depth: z.number().int().min(1).max(3).default(2).describe("Reply levels to include"),
    },
    annotations: readOnly,
  },
  ({ id, max_comments, depth }) =>
    run(async () => formatThread(await getItemWithComments(id, { maxComments: max_comments, depth }))),
);

server.registerTool(
  "arxiv_search",
  {
    title: "Search arXiv",
    description:
      "Search arXiv papers. With no query it returns the latest submissions in the given categories (default cs.AI). " +
      "Common categories: cs.AI, cs.LG, cs.CL (NLP), cs.CV, cs.RO, cs.SE, stat.ML.",
    inputSchema: {
      query: z.string().optional().describe("Keywords; all words must match"),
      categories: z.array(z.string()).optional().describe('e.g. ["cs.CL", "cs.LG"]'),
      sort: z.enum(["submitted", "relevance", "updated"]).default("submitted"),
      limit: z.number().int().min(1).max(50).default(15),
      summary_chars: z
        .number()
        .int()
        .min(-1)
        .default(400)
        .describe("Truncate abstracts to N chars; -1 = full abstract, 0 = omit"),
    },
    annotations: readOnly,
  },
  ({ query, categories, sort, limit, summary_chars }) =>
    run(async () => formatPapers(await searchPapers({ query, categories, sort, limit }), summary_chars)),
);

server.registerTool(
  "github_trending",
  {
    title: "GitHub Trending",
    description: "Get trending GitHub repositories, optionally filtered by programming language.",
    inputSchema: {
      language: z.string().optional().describe('e.g. "python", "typescript", "rust"'),
      since: z.enum(["daily", "weekly", "monthly"]).default("daily"),
      spoken_language: z.string().optional().describe('ISO 639-1 code for README language, e.g. "en", "ko"'),
      limit: z.number().int().min(1).max(25).default(25),
    },
    annotations: readOnly,
  },
  ({ language, since, spoken_language, limit }) =>
    run(async () =>
      formatRepos(await getTrending({ language, since, spokenLanguage: spoken_language, limit }), sinceLabel[since]),
    ),
);

server.registerTool(
  "tech_trends_digest",
  {
    title: "Tech trends digest",
    description:
      "One-shot digest of what's trending right now: HN front page, latest arXiv papers and GitHub Trending. " +
      "Good starting point for 'what's new in tech/AI today?'.",
    inputSchema: {
      per_source: z.number().int().min(1).max(25).default(10),
      arxiv_categories: z.array(z.string()).default(["cs.AI", "cs.LG", "cs.CL"]),
      github_language: z.string().optional(),
    },
    annotations: readOnly,
  },
  async ({ per_source, arxiv_categories, github_language }) => {
    // Each source fails independently so one outage doesn't sink the whole digest.
    const section = async (title: string, fn: () => Promise<string>) => {
      try {
        return `## ${title}\n\n${await fn()}`;
      } catch (err) {
        return `## ${title}\n\n_Unavailable: ${err instanceof Error ? err.message : String(err)}_`;
      }
    };
    const parts = await Promise.all([
      section("Hacker News — front page", async () => formatStories(await getStories("top", per_source))),
      section(`arXiv — latest in ${arxiv_categories.join(", ")}`, async () =>
        formatPapers(
          await searchPapers({ categories: arxiv_categories, sort: "submitted", limit: per_source }),
          200,
        ),
      ),
      section(`GitHub Trending — today${github_language ? ` (${github_language})` : ""}`, async () =>
        formatRepos(await getTrending({ language: github_language, since: "daily", limit: per_source }), "today"),
      ),
    ]);
    return text(`# Tech trends — ${new Date().toISOString().slice(0, 10)}\n\n${parts.join("\n\n")}`);
  },
);

await server.connect(new StdioServerTransport());
