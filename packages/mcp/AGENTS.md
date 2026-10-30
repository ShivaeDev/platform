# @shivaedev/mcp

This package lets an application's AI clients act as signed-in users through native Effect MCP tools. Applications declare toolkits and permissions; the adapter mounts them on the host's existing routes and supplies identity to their handlers.

Keep native Tool, Toolkit and McpServer visible. Identity owns authentication and permission decisions. A caller's registry and handler context belong to that request, so tools from another audience never enter discovery or dispatch. OAuth provider details stay in the Better Auth edge adapter; core routes require no optional peers.

Follow the repository's [AGENTS.md](../../AGENTS.md) and the [README](README.md).
