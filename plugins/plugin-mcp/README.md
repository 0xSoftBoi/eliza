# @elizaos/plugin-mcp

elizaOS plugin that connects an Eliza agent to external [Model Context Protocol](https://modelcontextprotocol.io) (MCP) servers and exposes their tools and resources as agent capabilities.

The plugin starts `McpService`, which connects to one or more MCP servers (stdio, SSE, or streamable-HTTP), discovers their tools and resources, and surfaces them through a single `MCP` action and an `MCP` provider. It is consumed by an elizaOS agent: add it to the character `plugins` array and configure servers under `settings.mcp.servers` or declare remote servers through the host environment.

Node-only. `index.browser.ts` is a browser-unavailable entry because the MCP SDK's stdio/SSE transports require Node APIs (`eliza.platforms` is `["node"]`).

## Install

```bash
bun add @elizaos/plugin-mcp   # or: npm install / yarn add
```

## Usage

Add the plugin and declare servers in your character file:

```json
{
  "name": "Your Character",
  "plugins": ["@elizaos/plugin-mcp"],
  "settings": {
    "mcp": {
      "servers": {
        "github": {
          "type": "stdio",
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-github"],
          "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "<YOUR_TOKEN>" }
        },
        "my-http-server": {
          "type": "streamable-http",
          "url": "https://example.com/mcp"
        }
      },
      "maxRetries": 2
    }
  }
}
```

Remote servers may instead be declared through the host environment. This is especially useful when authentication is required and credentials must not be serialized into character settings or MCP status data:

```bash
export MCP_SERVER_REMOTE_URL="https://example.com/mcp"
export MCP_SERVER_REMOTE_TYPE="streamable-http" # optional; this is the default
export MCP_SERVER_REMOTE_AUTHORIZATION="Bearer $REMOTE_MCP_TOKEN" # optional
```

`MCP_SERVER_<NAME>_AUTHORIZATION` is only paired with an env-declared `MCP_SERVER_<NAME>_URL`. The Authorization value is resolved when the HTTP/SSE transport is built and is not copied into `McpServerConfig`, connection status, or provider output. Blank values and values containing HTTP control characters fail closed. Rebuilding the transport re-reads the environment value, so credential rotation does not require storing a stale token in plugin state.

Configured servers live under `settings.mcp`; env-declared remote servers are merged on top and win on a name collision. The host `PATH` is forwarded to stdio child processes automatically. Malformed settings and rejected server configs fail service initialization instead of silently disabling or partially starting MCP. Every server config is validated by `@elizaos/core/security/mcp-server-config` (`validateMcpServerConfig`) before connect/spawn. Remote transports route every request through core's DNS-pinned SSRF guard, including redirects.

## Configuration

| Key | Type | Default | Description |
|---|---|---|---|
| `mcp.servers` | `Record<string, McpServerConfig>` | — | Map of server name → transport config |
| `mcp.maxRetries` | `number` | `2` | Max reconnect attempts per server |
| `MCP_SERVER_<NAME>_URL` | environment string | — | Declare a remote MCP server without persisting its URL in character settings |
| `MCP_SERVER_<NAME>_TYPE` | environment string | `streamable-http` | `streamable-http`, `http`, or `sse` |
| `MCP_SERVER_<NAME>_AUTHORIZATION` | environment string | — | Optional full HTTP Authorization value for the matching env-declared remote server |

Transport config (see `src/types.ts`):

- **stdio** — `{ type: "stdio", command, args?, env?, cwd?, timeoutInMillis? }`
- **HTTP/SSE** — `{ type: "streamable-http" | "http" | "sse", url, timeout? }`

## Plugin surface

- **Action `MCP`** — single entry point for all MCP operations. `action=call_tool` invokes a server tool, `action=read_resource` reads a server resource (`search_actions` / `list_connections` are cloud-runtime-only). Similes include `CALL_MCP_TOOL`, `READ_MCP_RESOURCE`, `USE_TOOL`.
- **Provider `MCP`** — injects a summary of connected servers, their status, tools, and resources into agent context.
- **`handleMcpRoutes`** (exported) — HTTP handler for `/api/mcp/*` (config CRUD, marketplace search, runtime status), wired up by the host server, not by the plugin object. The `McpRouteContext` type is also exported.
- **Marketplace client** (exported) — `searchMcpMarketplace` and `getMcpServerDetails` query the public MCP Registry with caller cancellation, a 10-second default deadline, a 2 MiB response limit, and stable `McpMarketplaceError` codes. Override those limits with `McpMarketplaceRequestOptions` when needed.

## src layout

```
src/
  index.ts              Plugin object — registers McpService, MCP action, MCP provider
  types.ts              Shared types + config guards (McpSettings, McpServerConfig, …)
  service.ts            McpService — connection lifecycle, tool calls, resource reads, ping/reconnect
  provider.ts           MCP provider — connected-server summary for agent state
  routes-mcp.ts         handleMcpRoutes — /api/mcp/config, /api/mcp/status, marketplace
  mcp-marketplace.ts    Client for registry.modelcontextprotocol.io (search + details)
  prompts.ts            Handlebars-style prompt templates
  actions/mcp.ts        mcpAction handler — op routing
  templates/            Thin re-export shims over prompts.ts
  utils/                Selection, validation, processing, error, and JSON helpers
  tool-compatibility/   Per-provider tool-schema fixup (Anthropic/OpenAI/Google)
```

## Commands

```bash
bun run build         # bun run build.ts → dist/ (ESM + CJS + .d.ts)
bun run dev           # hot-rebuild with bun --hot
bun run test          # vitest run
bun run typecheck     # tsgo --noEmit
bun run lint          # biome check --write --unsafe
bun run format        # biome format --write
bun run clean         # rm -rf dist .turbo
```

## Security

MCP servers can execute arbitrary code, so only connect to servers you trust. Spawn/connect of every configured server is gated on `validateMcpServerConfig` from `@elizaos/core/security/mcp-server-config`; remote requests additionally use core's DNS-pinned SSRF transport. For authenticated env-declared remote servers, keep credentials in `MCP_SERVER_<NAME>_AUTHORIZATION`; the plugin keeps that value out of serialized MCP config/status surfaces.

## License

MIT.
