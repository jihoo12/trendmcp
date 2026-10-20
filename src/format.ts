import type { ArxivPaper } from "./sources/arxiv.js";
import type { TrendingRepo } from "./sources/github.js";
import type { HnComment, HnStory } from "./sources/hackernews.js";

// Tools return compact Markdown: it is cheaper in tokens than JSON and easy for a model to cite.

export function formatStories(stories: HnStory[]): string {
  if (!stories.length) return "_No stories found._";
  return stories
    .map((s, i) => {
      const link = s.url ? ` — ${s.url}` : "";
      return `${i + 1}. **${s.title}**${link}\n   ${s.points} points · ${s.comments} comments · by ${s.author} · ${s.postedAt.slice(0, 16).replace("T", " ")} · [HN #${s.id}](${s.hnUrl})`;
    })
    .join("\n");
}

export function formatThread(t: { story: HnStory; text: string | null; comments: HnComment[] }): string {
  const lines = [`# ${t.story.title}`, formatStories([t.story]).replace(/^1\. \*\*.*?\*\*( — )?/, "").trim()];
  if (t.text) lines.push("", t.text);
  lines.push("", `## Comments (showing ${countComments(t.comments)} of ${t.story.comments})`);
  const walk = (cs: HnComment[], depth: number) => {
    for (const c of cs) {
      const indent = "  ".repeat(depth);
      const body = c.text.replace(/\n+/g, `\n${indent}  `);
      lines.push(`${indent}- **${c.author}**: ${body}`);
      walk(c.replies, depth + 1);
    }
  };
  walk(t.comments, 0);
  return lines.join("\n");
}

const countComments = (cs: HnComment[]): number => cs.reduce((n, c) => n + 1 + countComments(c.replies), 0);

export function formatPapers(papers: ArxivPaper[], summaryChars: number): string {
  if (!papers.length) return "_No papers found._";
  return papers
    .map((p, i) => {
      const authors = p.authors.length > 4 ? `${p.authors.slice(0, 4).join(", ")} et al.` : p.authors.join(", ");
      const summary =
        summaryChars > 0 && p.summary.length > summaryChars ? `${p.summary.slice(0, summaryChars).trimEnd()}…` : p.summary;
      return [
        `${i + 1}. **${p.title}** (arXiv:${p.id})`,
        `   ${authors} · ${p.primaryCategory} · ${p.published.slice(0, 10)} · ${p.absUrl} · [PDF](${p.pdfUrl})`,
        summaryChars !== 0 ? `   > ${summary}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export function formatRepos(repos: TrendingRepo[], period: string): string {
  if (!repos.length) return "_No trending repositories found._";
  return repos
    .map((r, i) => {
      const lang = r.language ? ` · ${r.language}` : "";
      const desc = r.description ? `\n   ${r.description}` : "";
      return `${i + 1}. **${r.name}** — ${r.url}${desc}\n   ★ ${r.stars.toLocaleString("en-US")} (+${r.starsInPeriod.toLocaleString("en-US")} ${period}) · ${r.forks.toLocaleString("en-US")} forks${lang}`;
    })
    .join("\n");
}
