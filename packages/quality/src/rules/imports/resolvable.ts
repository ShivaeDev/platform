import { importGraph } from "../../imports/graph.ts";
import { defineRule } from "../../rule.ts";

export const importsResolvable = defineRule({
	check: async (inputs) => {
		const graph = await importGraph(inputs);
		return graph.unresolved.map((request) => ({
			file: request.from,
			line: request.line,
			message: `Cannot resolve "${request.specifier}". Fix the path, install or declare the package, or declare the module in a .d.ts file among the sources.`,
			subject: request.specifier,
		}));
	},
	description: "Every import resolves to a file, a package or a declared module, so no edge of the import graph goes unchecked.",
	id: "imports/resolvable",
});
