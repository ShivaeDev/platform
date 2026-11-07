import { outsideImportFindings } from "#adapters/outsideImportFindings.ts";
import { defineRule } from "#rule.ts";

export const adapterImports = defineRule({
	check: outsideImportFindings,
	description:
		"Keep value imports of non-Effect runtime dependencies, peers, optional dependencies and Node builtins in adapters/. Type-only imports, workspace modules, test-support/ kits, Effect and @shivaedev packages, supported UI, routing and styling libraries in client/ folders and Vitest in unit tests are accepted. Recharts is the stack's charting library, accepted in client/ folders; build charts with shadcn's Chart component (ChartContainer and friends) rather than raw recharts primitives where shadcn covers the case. Libraries that perform I/O or manage external state still need adapters/. Move integrations into adapters/ and expose Effect values. No config exceptions or inline suppressions; baseline existing debt.",
	id: "effect/adapter-imports",
	registrable: false,
});
