# @shivaedev/work-board-plugin

The Work Board inside Claude Code: what needs you, what Fleet has in flight and how your goals are doing, one glance from the prompt.

## Why you want this

A Work Board runs beside your sessions, but its browser tab is not where you are looking. With the plugin, each Claude Code session finds its own Board and shows it where you work:
- a one-line band above the prompt that sums Needs you, In flight and Goals, with a button that opens the pane;
- a `/workboard` pane listing each Needs you item as a pressable line, started Fleet work grouped by goal with each agent’s activity, current or finished turn duration and PR number, and goal progress bars or a plain “all tasks done” check;
- a toast when a new decision lands for you;
- three read-only tools the model can call, named after the Board's own MCP tools: `board_overview`, `needs_you` and `item`.

## Using it

### How it finds the Board

The plugin needs a running Work Board. It finds one by walking up from the session's folder to the nearest folder that holds `.work`, and discovers its browser address over `.work/board.sock`. Its overview and tools then use Platform’s shared WebSocket client; file edits refresh the affected authorized queries. Start the Board in that folder:

```sh
npx @shivaedev/work-board .work
```

Without a `.work` folder, the pane and every tool say the session's folder has no Work Board and how to start one; with a Board that is not running, they say so and name the start command. The band stays hidden until the Board answers. Pressing a Needs you item opens it with `open -g` at the URL the Board says it is served on, so opening items works on macOS.

The plugin only reads the Board. Answer decisions in the Board itself or through [`@shivaedev/work-board`](../work-board/README.md).

### The pane

The pane folds goals with status `done` under an “Achieved (N)” row, closed by default. Click it to show those goals. Open goals stay visible, including goals whose tasks are all done. In flight and goal running counts use the same Board overview snapshot. If Fleet cannot be reached, In flight shows why it is unavailable.

### Install

Install it from this repository's marketplace. The install command needs Git, Node.js 24 or later and pnpm on your PATH. Claude Code asks you to approve the marketplace command, which fetches this repository and builds the plugin automatically. At the prompt of a terminal session, on Claude Code 2.1.299 or later:

```
/plugin install workboard --marketplace ShivaeDev/platform
```

Answer `y` to add the marketplace, then pick a scope. From a shell:

```sh
claude plugin install workboard --marketplace ShivaeDev/platform
```

With the marketplace already added (`/plugin marketplace add ShivaeDev/platform`), `/plugin install workboard@shivaedev` installs it too. In the desktop app, where `/plugin` does not run, click + next to the prompt box, then Plugins, Add marketplace with `ShivaeDev/platform`, then Add plugin.

### Developing it

```sh
pnpm --filter @shivaedev/work-board-plugin test
pnpm --filter @shivaedev/work-board-plugin typecheck
```

Pane stories render the element port with React in happy-dom. Check the runtime hooks, band and toasts by hand: start Claude Code with `--plugin-dir packages/work-board-plugin`, or list the folder in `CLAUDE_CODE_PLUGIN_DIRS`, in a folder with a running Work Board, then open `/workboard`.

Run `./script/update` from the repository checkout before loading the plugin with `--plugin-dir` or `CLAUDE_CODE_PLUGIN_DIRS`. Setup builds the Effect client and hooks into `src/adapters/generated/`, which git ignores. Package builds and test preparation also rebuild the bundle from current workspace sources; `pnpm build:client` remains available while editing. CI builds it through the existing package build and test preparation steps. The bundle contains no source maps.

For marketplace installs, the command source fetches a fresh checkout, installs its locked dependencies and builds the bundle before Claude Code copies the plugin into its cache. Claude Code runs that command on installation, updates and once per session. The temporary checkout is removed after the command finishes; the output directory contains only the plugin manifest, hooks, types and generated bundle. This private plugin is distributed through the marketplace and is not published to npm.
