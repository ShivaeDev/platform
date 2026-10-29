# @shivaedev/access

This package lets an application declare its permissions and roles once and use the same policy on servers and in browsers. Without it, authorization drifts into role-name comparisons scattered across handlers and screens, and a server check and a hidden button stop agreeing on who may do what.

The ideal is a small, browser-safe policy evaluator: the application declares exact named grants, a separate `.any` override for other owners' records, and one stored role string per user, and this package answers with booleans for interfaces and typed `Unauthorized` and `Forbidden` failures from `@shivaedev/errors` for enforcement. A stored role is decoded with the role set's Schema before use, and an unknown role fails visibly instead of becoming an empty role. Predicates and their enforcing Effects always give the same answer.

When goals conflict, explicit grants win over convenience: no wildcards, prefixes or implied permissions. Then native Effect and Schema, then browser safety, then a small API. Applications own role definitions, identity, persistence and role editing; this package evaluates their declarations and imports no server, database or platform infrastructure, so a feature that needs one of those belongs in `identity` or the application instead.

Read the [README](README.md) for the usage guide and the repository [AGENTS.md](../../AGENTS.md) for how the packages fit together.
