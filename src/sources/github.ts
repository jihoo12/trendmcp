import * as cheerio from "cheerio";
import { fetchText } from "../http.js";

export type Since = "daily" | "weekly" | "monthly";

export interface TrendingRepo {
  name: string;
  url: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  starsInPeriod: number;
}

const toInt = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

/** Scrape github.com/trending (there is no official API for it). */
export async function getTrending(opts: {
  language?: string;
  since: Since;
  spokenLanguage?: string;
  limit: number;
}): Promise<TrendingRepo[]> {
  const path = opts.language ? `/${encodeURIComponent(opts.language.toLowerCase())}` : "";
  const params = new URLSearchParams({ since: opts.since });
  if (opts.spokenLanguage) params.set("spoken_language_code", opts.spokenLanguage);

  const html = await fetchText(`https://github.com/trending${path}?${params}`);
  const $ = cheerio.load(html);
  const repos: TrendingRepo[] = [];

  $("article.Box-row").each((_, el) => {
    const row = $(el);
    const href = row.find("h2 a").attr("href")?.trim();
    if (!href) return;
    repos.push({
      name: href.replace(/^\//, ""),
      url: `https://github.com${href}`,
      description: row.find("p").first().text().replace(/\s+/g, " ").trim(),
      language: row.find('[itemprop="programmingLanguage"]').text().trim() || null,
      stars: toInt(row.find('a[href$="/stargazers"]').text()),
      forks: toInt(row.find('a[href$="/forks"]').text()),
      starsInPeriod: toInt(row.find("span.float-sm-right").text()),
    });
  });

  if (!repos.length && !html.includes("Box-row")) {
    throw new Error("Could not parse GitHub Trending page (layout may have changed)");
  }
  return repos.slice(0, opts.limit);
}
