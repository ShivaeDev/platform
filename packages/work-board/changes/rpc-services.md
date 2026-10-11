### Breaking

- Remove `/_board/search`, `/_board/history` and `/events`. Use the existing search, history and subscription operations at `POST /_board/rpc`.
- Resolve response and handoff methods through the native `Responses` and `HandoffsService` services and provide their Layers with `ResponseConfig`, instead of calling service factories. `HandoffsService` lives in `handoffs/Service.ts`.
- Import `Highlighter` from `render/Highlighter.ts` and call its `codeBlocks()` Effect for the rendering plugin. `THEMES` lives in `render/code.ts`.
