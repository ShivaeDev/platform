### Added

- `work-board mcp <dir>` serves the read-only `board_overview`, `needs_you` and `item` tools over stdio using Effect's MCP server. Tools query the running board's Unix socket for the same computed state as the browser and explain how to start a board when none answers.
