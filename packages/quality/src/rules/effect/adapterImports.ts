import { Effect } from "effect";
import { outsideImportFindings } from "#outsideImportFindings.ts";
import { defineRule } from "#rule.ts";
import { unsafeFindings } from "#rules/unsafeFindings.ts";

export const adapterImports = defineRule({
	check: (inputs) => Effect.map(outsideImportFindings(inputs), unsafeFindings),
	description:
		"Keep value imports of Node builtins in adapters/: file-system, process and other host access goes through Effect's platform services. Importing an outside library needs no adapter. Type-only imports, pure node:path calls (including node:path/posix and node:path/win32) anywhere, test-support/ kits, tool configs directly in a package's folder, and node:process in entry modules (cli/main/entry files, a top-level runMain and the import.meta.main and import.meta.url === process.argv[1] guards) are accepted. No config exceptions or inline suppressions; baseline existing debt.",
	id: "effect/adapter-imports",
	registrable: false,
});
