---
"@shivaedev/quality": patch
---

### Fixed

- `effect/service-parameters` accepts comparing a tag that a function only hands to a `.middleware(tag)` declaration or `Context.pick` with `undefined` or `null`, such as `tag === undefined` or `options?.middleware !== undefined`, because that only tests whether an optional tag is present. Code that read a property such as `tag?.key` to get past the rule can compare the tag itself. Returning, storing, yielding or calling the tag is still reported.
