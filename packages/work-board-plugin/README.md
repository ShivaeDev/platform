# Work Board plugin

The Work Board inside Claude Code: what needs you, what Fleet has in flight and how your goals are doing, one glance from the prompt.

## Why you want this

A Work Board runs beside your sessions, but its browser tab is not where you are looking. With the plugin, each Claude Code session finds its own Board and shows it where you work:

- a one-line band above the prompt that sums Needs you, In flight and Goals, with a button that opens the pane;
- a `/workboard` pane listing each Needs you item as a pressable line, in-flight Fleet work grouped by the goal it implements with its stage, time in stage and PR number, and every goal with a progress bar;
- a toast when a new decision lands for you;
- three read-only tools the model can call, named after the Board's own MCP tools: `board_overview`, `needs_you` and `item`.

## Using it

Install it from this repository's marketplace. At the prompt of a terminal session, on Claude Code 2.1.299 or later:

```
/plugin install workboard --marketplace ShivaeDev/platform
```

Answer `y` to add the marketplace, then pick a scope. From a shell:

```sh
claude plugin install workboard --marketplace ShivaeDev/platform
```

With the marketplace already added (`/plugin marketplace add ShivaeDev/platform`), `/plugin install workboard@shivaedev` installs it too. In the desktop app, where `/plugin` does not run, click + next to the prompt box, then Plugins, Add marketplace with `ShivaeDev/platform`, then Add plugin.

The plugin needs a running Work Board. It finds one by walking up from the session's folder to the nearest folder that holds `.work`, and asks the Board over `.work/board.sock`. Start the Board in that folder:

```sh
npx @shivaedev/work-board .work
```

Without a `.work` folder, the pane and every tool say the session's folder has no Work Board and how to start one; with a Board that is not running, they say so and name the start command. The band stays hidden until the Board answers. Pressing a Needs you item opens it with `open -g` at the URL the Board says it is served on, so opening items works on macOS.

The plugin only reads the Board. Answer decisions in the Board itself or through [`@shivaedev/work-board`](../work-board/README.md).

### Developing it

```sh
pnpm --filter @shivaedev/work-board-plugin test
pnpm --filter @shivaedev/work-board-plugin typecheck
```

`test` runs Vitest over the plugin's pure functions: reading the Board's RPC stream, the Needs you, Fleet and goal answers, the goal each flight implements, flight groups, stage counts, goal shares, the band line and the tools' answers. CI also runs a contract test in `@shivaedev/work-board`, `src/rpc/claudePluginContract.spec.ts`, which serves a real Board and reads its answers to the plugin's requests through these parsers, so a change to the Board's answers that the plugin reads fails there. `typecheck` checks the whole plugin against `src/claude-code.d.ts`, a short hand-written declaration of the part of Claude Code's mod API the plugin uses. Nothing installs or runs Claude Code.

The pane, the band, the toasts, the hooks and the tool registration are not tested automatically. Check them by hand: start Claude Code with `--plugin-dir packages/work-board-plugin`, or list the folder in `CLAUDE_CODE_PLUGIN_DIRS`, in a folder with a running Work Board, then open `/workboard`.
