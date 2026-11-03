# @shivaedev/agent-codex

This package makes local Codex available through the shared agent port. It owns provider process and protocol handling, event mapping and recovery; applications own durable storage, wake scheduling, runner logs and identity.

Acceptance truth wins over convenience: preserve operation IDs, keep missing evidence uncertain, and never replay an ambiguous mutation. Reads remain passive, steering names the expected turn, and queued delivery waits for the matching turn to drain. Child ownership must survive sparse provider notifications without resuming a child.

Keep provider details at the adapter boundary and unsupported behavior explicit. The scripted peer drives the real adapter through protocol frames; live validation belongs to adoption. Read the [README](README.md) for usage and the repository [AGENTS.md](../../AGENTS.md) for conventions.
