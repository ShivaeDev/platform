# @shivaedev/agent-claude-code

This package makes Claude Code usable through Platform's shared agent port. It owns the provider protocol, event conversion, MCP tool binding and recovery of provider transcripts. Applications own storage, wakeups, runner logs and application agent identity.

Preserve evidence before convenience: a provider pull acknowledges delivery, a native session identity acknowledges a run, and neither means completion. Keep ordinary queued input distinct from priority-now steering. Reconcile stream, mirror and repair lanes by provider UUID, retain workflow and subagent lineage, and expose missing or spilled output as a gap. Preserve native Effect scope and interruption semantics.

Declare only implemented features as supported. Keep the Claude and MCP SDKs optional peers at the adapter boundary. The story kit drives the real adapter through a scripted SDK peer; live provider smokes belong to adopting applications.

Read the [README](README.md) for usage and the repository [AGENTS.md](../../AGENTS.md) for development conventions.
