# @shivaedev/rate-limit

This package lets an application express a per-key budget once and choose where its counters live. Applications own key names, identity and policy; the package owns atomic admission and a typed refusal with a useful retry time.

Preserve atomicity first, native Effect services and clocks second, and a small API third. Stores count admitted calls in a window starting with the first call. A refusal consumes nothing and does not extend that window. Keep PostgreSQL behind its adapter and optional SQL peer; single-process consumers need only Effect. Database migrations remain explicit application choices.

Read the [README](README.md) for composition and limits, and the repository's [AGENTS.md](../../AGENTS.md) for checks and releases.
