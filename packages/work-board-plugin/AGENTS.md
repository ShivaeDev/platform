# Work Board plugin

The Work Board plugin brings the running Work Board into Claude Code, so a session sees what needs the maintainer, what Fleet has in flight and how goals are progressing without leaving the prompt. It is a Claude Code mod: a hooks module the Claude Code engine loads and draws, shipped from this repository's plugin marketplace and never published to npm.

The Board stays the source of truth. The plugin only reads it, over the `board.sock` of the nearest `.work` folder at or above the session's folder, and answers with what the Board said or why it could not ask: no Board in this folder, a Board that is not running, or a request it refused. It never writes to the Board and never guesses state it was not given.

When goals conflict, a truthful view comes first, then one quiet glance (a single band line, a toast only for a new decision), then parity with the Board's own MCP tools, then visual polish.

The engine sets the rules this package lives by: JSX against its global `h`, the `claude-code` module it provides at runtime, and relative imports for anything it loads. The package never installs or runs Claude Code. `src/claude-code.d.ts` hand-declares only the part of that module the plugin uses, shaped from what the code calls, so the whole package typechecks with nothing downloaded; when the plugin starts using more of the API, or the API changes, update that file by hand. The code lives in `src/` like every package's, with `hooks/hooks.json` naming `../src/register.tsx`.

Pane stories feed Board replies through the plugin's parsers and render its element port with React in happy-dom. They prove the pane's text, counts and supplied colors; they do not run Claude Code. Check the runtime hooks, band and toasts by loading the plugin into Claude Code with `--plugin-dir`. The contract test `@shivaedev/work-board` keeps feeds a real Board's answers through the plugin's parsers. Keep parsing and shaping in modules that import no `claude-code` value so CI covers them. Usage and install live in the [README](README.md); the Board's queries live in [`@shivaedev/work-board`](../work-board/README.md).
