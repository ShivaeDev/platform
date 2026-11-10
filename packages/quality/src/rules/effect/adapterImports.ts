import { outsideImportFindings } from "#adapters/outsideImportFindings.ts";
import { defineRule } from "#rule.ts";

export const adapterImports = defineRule({
	check: outsideImportFindings,
	description:
		"Keep value imports of Node builtins in adapters/: file-system, process and other host access goes through Effect's platform services. Outside libraries need no adapter. Type-only imports, pure node:path calls (including node:path/posix and node:path/win32) anywhere, test-support/ kits, tool configs directly in a package's folder, and node:process in entry modules (cli/main/entry files, runMain callers and the import.meta.url === process.argv[1] guard) are accepted. No config exceptions or inline suppressions; baseline existing debt.",
	id: "effect/adapter-imports",
	registrable: false,
});
