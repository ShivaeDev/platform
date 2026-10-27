# @shivaedev/access

This package lets applications declare permissions and roles once and use the same policy on servers and in browsers. A stored role is one application-defined string; decode it with the role set's Schema before using it. An unknown role must fail visibly instead of becoming an empty role.

Keep authorization explicit: exact named grants, an explicit override for other owners' records, and typed expected failures from `contract`. Prefer native Effect and Schema, then browser safety, then a small API. Applications own role definitions, identity, persistence and policy; this package evaluates their declarations without importing platform or server infrastructure.

Keep predicates and enforcement consistent and prove the public policy through the story kit. See the [README](README.md) for usage and the [root guidance](../../AGENTS.md) for repository conventions.
