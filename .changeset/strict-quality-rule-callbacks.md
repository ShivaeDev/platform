---
"@shivaedev/quality": minor
---

### Breaking

- Rule configuration callbacks are strictly typed. Replace heterogeneous `Rule[]` annotations with `RegisteredRule[]`, or use `satisfies readonly RegisteredRule[]` to retain per-rule config inference. Keep each rule's inferred type when configuring it directly, and register local rules with `defineConfig` to validate unknown configuration input.
- Import `StandardSchemaV1`, `StandardResult`, `StandardIssue` and `describeIssue` from `@shivaedev/quality/adapters/standardSchema.ts` instead of `@shivaedev/quality/standardSchema.ts`.
