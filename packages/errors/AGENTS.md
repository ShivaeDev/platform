# @shivaedev/errors

This package names the failures every Effect application expects and keeps secrets out of the failures it does not expect. Contracts, servers, clients and integrations all import the same tagged error classes from here, so a `Conflict` thrown in a handler is the `Conflict` a form reads on the client. The redaction helpers sit beside them because every boundary that reports a failure, whether a log line, a trace or an RPC reply, needs the same answer to "which values are secret".

The ideal is a small, dependency-free vocabulary that runs anywhere: the browser, a worker and a server import the same modules, and nothing here reaches a transport, a database or Node. When goals conflict, browser safety comes first, then one shared class per expected failure over per-feature copies, then conservative redaction over complete diagnostics. A new failure class belongs here only when several packages or applications need to agree on it; a feature-specific rejection stays in that feature's contract.

Read the [README](README.md) for the usage guide and the repository [AGENTS.md](../../AGENTS.md) for how the packages fit together.
