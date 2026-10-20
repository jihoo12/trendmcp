# trendmcp

[English](README.md) | **한국어**

Hacker News, arXiv, GitHub Trending을 읽어서 AI에게 전달하는 MCP 서버입니다.
API 키가 필요 없고, 모든 결과를 토큰 효율적인 Markdown으로 반환합니다.

## Tools

| Tool | 설명 |
| --- | --- |
| `hackernews_stories` | HN top / new / best / ask / show 피드 |
| `hackernews_search` | Algolia 기반 HN 스토리 검색 (기간·최소 점수 필터) |
| `hackernews_thread` | 스토리 + 상위 댓글 트리 (여론 요약용) |
| `arxiv_search` | 키워드·카테고리로 arXiv 논문 검색, 쿼리 없으면 최신 논문 |
| `github_trending` | GitHub Trending (언어, daily/weekly/monthly) |
| `tech_trends_digest` | 위 세 소스를 한 번에 모은 오늘의 트렌드 요약 |

## 설치

```bash
npm install
npm run build
```

## 연결

**Claude Code**

```bash
claude mcp add trendmcp -- node /absolute/path/to/trendmcp/dist/index.js
```

**Claude Desktop / 기타 MCP 클라이언트** (`claude_desktop_config.json` 등)

```json
{
  "mcpServers": {
    "trendmcp": {
      "command": "node",
      "args": ["/absolute/path/to/trendmcp/dist/index.js"]
    }
  }
}
```

## 참고

- 응답은 5분간 메모리에 캐시됩니다.
- arXiv API 이용 규칙에 따라 arXiv 요청은 3초 간격으로 보내고, 429 응답이 오면 재시도합니다.
- GitHub Trending은 공식 API가 없어 HTML을 파싱합니다. GitHub가 페이지 구조를 바꾸면 수정이 필요할 수 있습니다.
