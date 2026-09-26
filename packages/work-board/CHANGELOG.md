# Changelog

## Unreleased

### Changed

- Consolidate duplicate test cases around observable package behavior.

- Validate packed consumers and executable bins through the shared workspace gate.

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
