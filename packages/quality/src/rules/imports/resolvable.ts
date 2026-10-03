import { Effect, Schema } from "effect";
import { withoutGenerated } from "../../imports/generated.ts";
import { importGraph } from "../../imports/graph.ts";
import { defineRule } from "../../rule.ts";

const ResolvableOptions = Schema.Struct({
	generated: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

export const importsResolvable = defineRule({
	check: async ({ options, ...inputs }) => {
		const unresolved = await withoutGenerated(inputs, await importGraph(inputs), options.generated);
		return unresolved.map((request) => ({
			file: request.from,
			line: request.line,
			message: `Cannot resolve "${request.specifier}". Fix the path, install or declare the package, or declare the module in a .d.ts file among the sources.`,
			subject: request.specifier,
		}));
	},
	description: "Every import resolves to a file, a package or a declared module, so no edge of the import graph goes unchecked.",
	id: "imports/resolvable",
	options: Schema.toStandardSchemaV1(ResolvableOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
