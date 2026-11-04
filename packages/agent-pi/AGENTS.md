# @shivaedev/agent-pi

This package gives Effect applications Pi's embedded agent through the shared agent port. It owns the provider protocol, event translation and provider recovery. Application agent identity, storage, wake policy and runner logs stay with the application.

Truth about acceptance and execution wins first: preflight acceptance is independent of completion, steering is distinct from follow-up input, and a retrying Pi run is still open. Preserve the native session-file reference and use Pi's SessionManager for resume. Missing local recovery evidence stays uncertain. Keep support declarations honest; unsupported features must remain visible to negotiation.

Prefer native Effect scope lifetimes and a thin SDK boundary. The SDK is an optional peer, loaded only for provider operations. Story kits run the real adapter against a scripted SDK peer, retaining the real SessionManager for file-backed recovery; live provider smokes belong to consuming applications.

Read the [README](README.md) for usage and the repository [AGENTS.md](../../AGENTS.md) for development conventions.
