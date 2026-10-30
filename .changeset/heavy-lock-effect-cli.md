---
"@shivaedev/heavy-lock": minor
---

### Added

- The command line provides Effect CLI help, version output and flag validation through the Node Effect runtime, while preserving wrapped commands' exit codes and signal handling.

### Breaking

- Invalid CLI arguments exit with code `1` instead of `2`; update scripts that distinguish usage errors. Usage goes to stdout and error details go to stderr. Continue using `heavy-lock -- <command> [args...]` to pass child flags unchanged; commands without flags can now omit `--`.
- The exposed `cli/args.ts` parser module is removed. Consumers of `parseCommandLine` or `USAGE` should use `effect/cli` to parse and render usage. Import `CommandLine` from `cli/runCommand.ts`; `cli/program.ts` now accepts that parsed command tuple without the `--` separator.
