# trendmcp

**English** | [한국어](README.ko.md)

An MCP server that reads Hacker News, arXiv and GitHub Trending and hands the results to your AI assistant.
No API keys required, and every tool returns token-efficient Markdown.

## Tools

| Tool | Description |
| --- | --- |
| `hackernews_stories` | HN top / new / best / ask / show feeds |
| `hackernews_search` | Search HN stories via Algolia (filter by age and minimum points) |
| `hackernews_thread` | A story plus its top comment tree, for summarizing the discussion |
| `arxiv_search` | Search arXiv by keywords and categories; latest papers when no query is given |
| `github_trending` | GitHub Trending (by language, daily / weekly / monthly) |
| `tech_trends_digest` | A one-shot digest of today's trends across all three sources |

## Usage

Requires Node.js 20.18.1 or later. No install step needed — `npx` fetches it from npm.

**Claude Code**

```bash
claude mcp add trendmcp -- npx -y trendmcp
```

**Claude Desktop / other MCP clients** (`claude_desktop_config.json`, etc.)

```json
{
  "mcpServers": {
    "trendmcp": {
      "command": "npx",
      "args": ["-y", "trendmcp"]
    }
  }
}
```

## Development

```bash
npm install
npm run build
claude mcp add trendmcp -- node /absolute/path/to/trendmcp/dist/index.js
```

## Notes

- Responses are cached in memory for 5 minutes.
- Per arXiv's API terms of use, arXiv requests are spaced 3 seconds apart and retried on HTTP 429.
- GitHub Trending has no official API, so the HTML page is parsed. It may need updating if GitHub changes the page layout.
