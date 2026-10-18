import { Effect, Schema } from "effect";
import { importGraph } from "#imports/graph.ts";
import { isTestSupport } from "#naming/testName.ts";
import { defineRule } from "#rule.ts";
import { matchesAny } from "./matchesAny.ts";

const SupportImportsOptions = Schema.Struct({
	modules: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

export const supportImports = defineRule({
	check: async ({ options, ...inputs }) => {
		if (!inputs.sources.some((file) => isTestSupport(file.path))) {
			return [];
		}
		const graph = await importGraph(inputs);
		return graph.edges
			.filter(
				(edge) => isTestSupport(edge.from) && edge.to.kind === "file" && !isTestSupport(edge.to.path) && !matchesAny(edge.to.path, options.modules),
			)
			.map((edge) => ({
				file: edge.from,
				line: edge.line,
				message: `Test-support imports "${edge.specifier}" outside its allowed public surface. Drive the app through its host, schemas or queue definitions; list those public module paths in tests/support-imports.options.modules in the repository's quality config.`,
				subject: edge.specifier,
			}));
	},
	description: "Test-support reaches repository modules only through the public surface named by the repository's module allowlist.",
	id: "tests/support-imports",
	options: Schema.toStandardSchemaV1(SupportImportsOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
