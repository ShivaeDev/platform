import { outsideImportFindings } from "#adapters/outsideImportFindings.ts";
import { defineRule } from "#rule.ts";

export const adapterImports = defineRule({
	check: outsideImportFindings,
	description:
		"Keep value imports of non-Effect runtime dependencies, peers, optional dependencies and Node builtins in adapters/. Type-only imports, workspace modules, test-support/ kits, Effect and @shivaedev packages and React in client/ folders and Vitest in unit tests are accepted. Move integrations into adapters/ and expose Effect values. No config exceptions or inline suppressions; baseline existing debt.",
	id: "effect/adapter-imports",
	registrable: false,
});
