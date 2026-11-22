---
"@shivaedev/vitest-rerun": minor
---

### Breaking

- A Vitest config and its global setup run through `vitest-rerun` now see `TEST=true` and `VITEST=true`, as under `vitest run`, which sets both before it loads the config. Before, both were unset there, so a config that branches on `process.env.VITEST`, such as one that turns a dev-only plugin off under Vitest, took its non-Vitest branch in CI and now takes the same branch as a local `vitest run`. A value the caller sets is kept. A config that relied on the old branch under `vitest-rerun` checks for its own variable instead, or its caller sets `VITEST` to the value it needs.
