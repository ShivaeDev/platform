import { Effect } from "effect";
import { generatedFolders, generatedFrom } from "#imports/generatedFolders.ts";
import { importGraph, type UnresolvedImport } from "#imports/graph.ts";
import { defineRule } from "#rule.ts";

function repair(folders: readonly string[], request: UnresolvedImport): string {
	const module = request.missing === undefined ? undefined : generatedFrom(folders, request.missing);
	return module === undefined
		? "Fix the path, install or declare the package, or declare the module in a .d.ts file among the sources."
		: `The project's generate script writes ${request.missing} only when ${module} defines a module. Fix the path, or define the module there.`;
}

export const importsResolvable = defineRule({
	check: Effect.fn("Imports.check")(function* (inputs) {
		const graph = yield* importGraph(inputs);
		const folders = generatedFolders(graph.packages);
		return [
			...graph.configFindings,
			...graph.unresolved.map((request) => ({
				file: request.from,
				line: request.line,
				message: `Cannot resolve "${request.specifier}". ${repair(folders, request)}`,
				subject: request.specifier,
			})),
		];
	}),
	description: "Every import resolves to a file, a package or a declared module, so no edge of the import graph goes unchecked.",
	id: "imports/resolvable",
});
