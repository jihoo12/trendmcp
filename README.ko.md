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

## 사용법

Node.js 20.18.1 이상이 필요합니다. `npx`가 npm에서 바로 받아 실행하므로 따로 설치할 필요가 없습니다.

**Claude Code**

```bash
claude mcp add trendmcp -- npx -y trendmcp
```

**Codex CLI / IDE 확장**

Codex CLI가 설치된 상태에서 다음 명령으로 서버를 등록합니다.

```bash
codex mcp add trendmcp -- npx -y trendmcp
```

또는 `~/.codex/config.toml`에 다음 설정을 추가합니다.

```toml
[mcp_servers.trendmcp]
command = "npx"
args = ["-y", "trendmcp"]
```

CLI와 IDE 확장은 이 설정을 공유합니다. `codex mcp list`로 등록 여부를 확인하거나, Codex 안에서 `/mcp`로 활성 서버를 확인할 수 있습니다.
자세한 내용은 [공식 Codex MCP 문서](https://developers.openai.com/codex/mcp)를 참고하세요.

**Claude Desktop / 기타 MCP 클라이언트** (`claude_desktop_config.json` 등)

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

## 개발

```bash
npm install
npm run build
claude mcp add trendmcp -- node /absolute/path/to/trendmcp/dist/index.js
```

## 참고

- 응답은 5분간 메모리에 캐시됩니다.
- arXiv API 이용 규칙에 따라 arXiv 요청은 3초 간격으로 보내고, 429 응답이 오면 재시도합니다.
- GitHub Trending은 공식 API가 없어 HTML을 파싱합니다. GitHub가 페이지 구조를 바꾸면 수정이 필요할 수 있습니다.
