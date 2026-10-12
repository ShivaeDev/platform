import { browserGlobals } from "#imports/browserGlobals.ts";
import { importGraph } from "#imports/graph.ts";
import { builtinName } from "#imports/resolve.ts";
import { type Runtime, runtimeOf } from "#imports/runtime.ts";
import { isTestCode } from "#naming/testName.ts";
import { defineRule } from "#rule.ts";

function forbiddenImport(from: Runtime, to: Runtime | undefined, builtin: boolean): boolean {
	if (from === "shared") {
		return to === "client" || to === "server" || builtin;
	}
	return from === "client" && (to === "server" || builtin);
}

export const importsRuntime = defineRule({
	check: async (inputs) => {
		const graph = await importGraph(inputs);
		const runtime = runtimeOf(inputs, graph.packages);
		const imports = graph.edges.flatMap((edge) => {
			const from = runtime(edge.from);
			if (from === undefined || isTestCode(edge.from)) {
				return [];
			}
			const to = edge.to.kind === "file" ? runtime(edge.to.path) : undefined;
			const builtin = edge.to.kind === "external" && builtinName(edge.to.specifier) !== undefined;
			if (!forbiddenImport(from, to, builtin)) {
				return [];
			}
			return [
				{
					file: edge.from,
					line: edge.line,
					message: `${from === "client" ? "Client" : "Shared"} code imports ${builtin ? "Node built-in" : `${to} code`} through "${edge.specifier}". Move runtime-dependent code into src/client/ or src/server/ and keep shared code independent of both runtimes.`,
					subject: edge.specifier,
				},
			];
		});
		return [...imports, ...inputs.sources.filter((file) => !isTestCode(file.path) && runtime(file.path) === "shared").flatMap(browserGlobals)];
	},
	description:
		"In packages with src/client/ or src/server/, folder names define runtime boundaries. Shared code runs in either runtime without browser globals or Node built-ins.",
	id: "imports/runtime",
});
