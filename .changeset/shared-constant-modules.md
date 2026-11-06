---
"@shivaedev/quality": minor
"@shivaedev/agent-claude-code": minor
"@shivaedev/agent-codex": minor
"@shivaedev/agent-opencode": minor
"@shivaedev/agent-pi": minor
"@shivaedev/identity": minor
"@shivaedev/releases": minor
"@shivaedev/sql": minor
"@shivaedev/vitest-rerun": minor
---

### Breaking

- `@shivaedev/quality`: Name plain-data constants modules in camelCase for words every constant shares, or use `limits.ts` for max/min/limit constants and `defaults.ts` for default constants. Rename single-constant PascalCase files such as `ProfileKey.ts` to `profileKey.ts`; split unrelated constants or group heterogeneous copy in one named record. Rename files whose names came from a private constant or an extra constant beside their one other runtime export to match that export. The same rules apply to test-support kits; computed values, schemas, Layers and functions do not count as constants.
- `@shivaedev/quality`: Direct module imports move from `config/constants.ts` to `config/file.ts` or `config/defaultExtensions.ts`, from `cli/messages.ts` to `cli/usage.ts` or `cli/subcommands.ts`, from `cli/options.ts` to `cli/misplaced.ts`, from `naming/migrationFile.ts` to `naming/isMigrationFile.ts`, and from `rules/suppressions/directives.ts` to `rules/suppressions/in.ts`. Import `MAX_FIX_ROUNDS` from `cli/limits.ts` instead of `cli/fix.ts`.
- `@shivaedev/sql`: Import `MIGRATIONS_DIRECTORY` and `MIGRATION_FILE_PATTERN` from `@shivaedev/sql/migration.ts` instead of `@shivaedev/sql/migrationConvention.ts`.
- `@shivaedev/vitest-rerun`: Import `DEFAULT_OUTPUT_DIR` and `DEFAULT_RERUNS` from `@shivaedev/vitest-rerun/defaults.ts` instead of `@shivaedev/vitest-rerun/options.ts`.
- `@shivaedev/releases`: Import `packageAttribution` from `@shivaedev/releases/packageAttribution.ts` instead of `@shivaedev/releases/parser.ts`.
- `@shivaedev/agent-claude-code`: Import the tool server adapter from `adapters/makeToolServer.ts` instead of `adapters/toolServer.ts`.
- `@shivaedev/agent-codex`: Import the rate-limit event adapter from `adapters/rateLimitEvents.ts` instead of `adapters/rateLimits.ts`.
- `@shivaedev/agent-opencode`: Import the tool naming adapter from `adapters/wireName.ts` instead of `adapters/toolNames.ts`.
- `@shivaedev/agent-pi`: Import the thinking-level adapter from `adapters/thinkingLevel.ts` instead of `adapters/effort.ts`.
- `@shivaedev/identity`: Import the client IP adapter from `server/better-auth/adapters/clientIpHeaders.ts` instead of `server/better-auth/adapters/clientIp.ts`.
