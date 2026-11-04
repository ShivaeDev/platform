---
"@shivaedev/agent-claude-code": minor
---

### Added

- Implement the shared agent port for Claude Code with native session resume, distinct queued input and priority-now steering, interruption and scoped query cleanup.
- Bind application MCP tools and convert provider messages, child lineage, usage and cost into shared agent events.
- Reconcile stream, mirror and repair transcript lanes by provider UUID, declaring missing and spilled output as explicit gaps. Keep the Claude and MCP SDKs optional peers; image input and model discovery remain unsupported.
