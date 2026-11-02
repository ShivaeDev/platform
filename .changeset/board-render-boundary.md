---
"@shivaedev/work-board": minor
---

### Changed

- Production and embedded Board servers start without constructing a server renderer.
- Markdown and code rendering return rendered content or a typed `RenderFailed` through the scoped `Highlighter` service.

### Breaking

- Replace `Highlighter.codeBlocks()` plugin access with `Highlighter.markdown(source, options)` for rendered HTML, including highlighted code blocks. Failures now stay in the Effect error channel; provide `Highlighter.layer` within a scope.
- The `render/code.ts` module moves under adapters. Consumers that assembled rendering plugins should use `server/render/Highlighter.ts` instead.
