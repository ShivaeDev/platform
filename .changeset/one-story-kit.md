---
"@shivaedev/test-story": minor
---

### Breaking

- Remove the legacy engine-first `storyKit` overload. Replace `storyKit<Engine, "ready", Verbs>({ ... })` with `storyKit({ ... })`; annotate the return type of `create` when an explicit engine shape is needed. Stages, verbs and services are inferred from the definition.
- Remove `fakeHttpService.failOnce` and `replyOnce`. Replace either `api.failOnce(route, reply, scope)` or `api.replyOnce(route, reply, scope)` with `api.scriptFault(route, { kind: "status", reply }, scope)`. The default still consumes only the next authorized matching request. The result now contains a `lift` effect, and narration uses the existing scripted-fault wording.
