---
"@shivaedev/github": minor
---

### Breaking

- Replace `GitHubAppError.stage` with string `reason` literals: `sign`, `encode`, `transport`, `status` and `response`. Migrate `stage === "sign"` handlers to `reason === "sign"`; replace `stage === "exchange"` handlers with the appropriate exchange reason. HTTP refusals retain `status`. Caught signing, encoding, transport and response failures retain their original non-enumerable `cause`; keep causes in trusted diagnostics because underlying requests can contain credentials.
