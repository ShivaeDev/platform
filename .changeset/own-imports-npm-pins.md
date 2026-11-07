---
"@shivaedev/quality": minor
---

### Breaking

- Require package `#` aliases for every own-module import, including same-folder imports and registration subtrees. Replace relative imports with aliases declared in the package.json `imports` map.
- Reject `file:` and `link:` dependencies in published and private packages. Replace them with exact npm versions or `workspace:`/`catalog:` references.
