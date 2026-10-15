# MCP setup

Two kinds of MCP servers are useful here: the factory's own server (Claude drives the pipeline) and provider servers (Claude explores voices and models with you before you commit them to a spec). Why production calls APIs directly instead of through MCP is explained in [STACK.md](STACK.md#mcp-servers).

## The video-factory server

Tools it exposes:

| Tool | Does |
|---|---|
| `list_projects` | Projects, titles, scene counts, build status |
| `create_project` | Scaffold a project, optionally with a brief or finished script |
| `plan_video` | Storyboard the brief or script into `video.yaml` with Claude |
| `get_spec` / `update_spec` | Read or replace `video.yaml` (validated before saving, `.bak` kept) |
| `check_video` | Schema errors, editorial lint, cost estimate |
| `review_facts` | Fact-check with web search, returns `review.md` |
| `build_video` | Full build and render (mock or real, any preset, aspect or scene range) |
| `publish_youtube` | Upload to YouTube (private by default) |
| `list_options` | Theme presets and scene templates |

### Claude Code

```bash
claude mcp add video-factory -- npx tsx /absolute/path/to/Video-factory/src/mcp/server.ts
```

### Claude Desktop

Add to `claude_desktop_config.json` (Settings, Developer, Edit Config):

```json
{
  "mcpServers": {
    "video-factory": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/Video-factory/src/mcp/server.ts"]
    }
  }
}
```

The server reads API keys from the repo's `.env`. Renders run on the machine hosting the server, so use one with 4+ cores.

### What a session looks like

> Make a 6-minute video on how vaccines train the immune system for high schoolers. Use the paper theme. Draft the brief, plan it, fact-check it, and show me a mock render.

Claude calls `create_project` with a brief, `plan_video`, `review_facts`, applies fixes with `update_spec`, then `build_video` with `mock: true`. You watch the draft, say "scene 5 drags, make it a steps diagram", and it edits and re-renders only what changed. When you approve, `build_video` with `mock: false`, then `publish_youtube`.

## Provider servers worth adding

### ElevenLabs (official)

Audition voices, design new ones, generate sound effects, clone your voice.

```bash
claude mcp add elevenlabs -e ELEVENLABS_API_KEY=your_key -- uvx elevenlabs-mcp
```

Desktop config equivalent: command `uvx`, args `["elevenlabs-mcp"]`, env `ELEVENLABS_API_KEY`. Needs `uv` installed. When you find a voice you like, put its id in `voice.voiceId`.

### fal (official, hosted)

Search and try 1,000+ image and video models.

```bash
claude mcp add --transport http fal-ai https://mcp.fal.ai/mcp --header "Authorization: Bearer $FAL_KEY"
```

For Claude Desktop or claude.ai, fal's docs describe adding a custom connector with browser sign-in; check [fal's MCP setup page](https://fal.ai/docs/documentation/setting-up/mcp/claude) for the current URL. When a model wins, put its id in `providers.imageModel` / `providers.videoModel` (or per scene in `visual.model`).

### Remotion docs

Lets Claude look up Remotion APIs while building new scene templates.

```bash
claude mcp add remotion -- npx @remotion/mcp@latest
```

### Replicate (optional)

An alternative model catalog if a model you want isn't on fal.

```bash
claude mcp add replicate -e REPLICATE_API_TOKEN=your_token -- npx -y replicate-mcp
```

### Figma, Google Drive, GitHub

Available as claude.ai connectors. Figma for pulling brand colors, fonts and logos into `style`; Drive for sharing renders and `review.md` with collaborators; GitHub for versioning your specs.
