# Changelog

## Unreleased

### Added

- Add local workspace search with document, heading, and passage results, snippets,
  keyboard navigation, and a command dialog for existing view controls. Rebuild
  the in-memory index after file changes, disclose unreadable files, and prevent
  older search responses from replacing newer queries.

- Add heading passage links and an outline, in-place document navigation with
  back/forward reading-state restoration, workspace-scoped favorites and recents,
  active document titles, and readable missing-document/passage states.
- Resolve Markdown links relative to the source file, including nested home
  files served at `/`. Ignore stale page responses after navigation and render
  cached diagrams using the current theme.
- Add the first workspace shell: a collapsible file sidebar, file location,
  responsive board columns, readable documents, and keyboard skip navigation.
  Remember theme, density, and sidebar choices per folder and server origin;
  code highlighting and diagrams follow the selected theme. Controls remain
  usable when browser storage is unavailable.

- Add a step-by-step delivery plan for the vision, with 26 bounded implementation
  steps, dependencies, acceptance evidence, and explicit design gates before
  richer source formats, mutations, agent handoffs, and external integrations.

- Document the local Work Board north star, three-wave roadmap, experience design,
  and interactive vision mockups with desktop and mobile captures. The package
  README links to the proposed direction separately from its current behavior.

## 0.2.1 - 2026-10-04

### Changed

- Imports that leave their folder go through `#` aliases declared in the `imports` field of `package.json`: `#*.ts` resolves to `src` under the `source` condition and to `dist` otherwise, and `#test/*` names a test file. The published modules and declarations name the package's own files through these aliases. `boardLayer` declares its error and service types, unchanged, so its declaration imports every module through an alias that a NodeNext consumer resolves.

- Consolidate duplicate test cases around observable package behavior.

- Validate packed consumers and executable bins through the shared workspace gate.

- Build with the `@shivaedev/quality` tsconfig presets, which target ESNext and allow only erasable TypeScript syntax.

- Type-check with TypeScript 7 only. TypeScript 6 still builds the package.

- Lint and format with the `@shivaedev/quality` Biome preset through `quality lint` at the repository root, which replaces the package's `check` script.

- Run tests through the `@shivaedev/quality` Vitest projects, which take a test's environment from its file name. Type tests are named `*.typecheck.test.ts`.

- Keep `package.json` in sort-package-json key order, checked by `quality lint`.

## 0.2.0 - 2026-09-28

### Changed

- Add `@effect/platform-node-shared` as a peer dependency pinned to the same
  exact version as the `effect` and `@effect/platform-node` peers, so an
  install holds one copy of Effect. An application that embeds `boardLayer` and
  already depends on the Effect stack adds `@effect/platform-node-shared` at
  that version; pnpm, npm and Bun install it otherwise.

### Fixed

- Pin `@effect/platform-node-shared` to the `effect` version, so the
  `work-board` command starts after a fresh install. Before,
  `@effect/platform-node` resolved a newer `@effect/platform-node-shared`
  prerelease than its `effect`, and the command crashed on start importing
  modules that `effect` lacks.

## 0.1.0 - 2026-09-26

### Added

- Add the `work-board` command: `work-board <dir> [--port 4747] [--home <file>]`
  serves every markdown file under a folder on 127.0.0.1 from one long-lived
  process, with a top bar listing them and how long ago each changed. Files
  and folders below it starting with a dot and `node_modules` are never
  entered, the folder itself may be a dot folder, paths and symlinks leading
  outside the folder are never served, requests whose `Host` header is not a
  loopback host are refused, and a missing `--home` file stops the command
  with an error.
- Pages render GitHub Flavored Markdown on the server with raw HTML allowed,
  including `<details>` blocks with markdown inside, and highlight fenced code
  with Shiki in light and dark. Mermaid diagrams are drawn in the browser from
  the installed package, only on pages that have one, into reserved space and
  without ever showing their source while drawing; they follow the colour
  scheme, and a diagram that does not parse shows its source and the error.
- The `--home` file is shown at `/` as a board: `##` sections, `###` items, a
  footer after a `---` that follows the last heading, and a count per section
  derived from its items. Reference links and footnotes work inside cards.
- Pages update in place: the server watches the folder recursively and pushes
  the changed markdown paths over server-sent events at `/events`, and the page
  replaces only the changed blocks without reloading, keeping which `<details>`
  are open, every drawn diagram that did not change, and an edited diagram's old
  drawing until its new one is ready. A refresh that gets no page back keeps the
  page and says so. A failed watch is restarted, waiting longer after each
  failure, while pages show "reconnecting" and then catch up. Ctrl-C stops the
  command at once, even with pages open.
- Add `boardLayer`, the router Layer the command serves, for embedding the board
  in another Effect HTTP server or as a fetch handler.
