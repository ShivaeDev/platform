import { Effect } from "effect";
import { type ImportGraph, importGraph } from "#imports/graph.ts";
import { builtinName } from "#imports/packageName.ts";
import { type Runtime, runtimeDeclarationProblems, runtimeOf } from "#imports/runtime.ts";
import { isTestCode } from "#naming/testName.ts";
import { defineRule } from "#rule.ts";

function forbiddenImport(from: Runtime, to: Runtime | undefined, builtin: boolean): boolean {
	if (from === "shared") {
		return to === "client" || to === "server" || builtin;
	}
	return from === "client" && (to === "server" || builtin);
}

function runtimeFindings(graph: ImportGraph, runtime: (path: string) => Runtime | undefined) {
	return graph.edges.flatMap((edge) => {
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
}

export const importsRuntime = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const graph = yield* Effect.promise(() => importGraph(inputs));
			const runtime = yield* runtimeOf(inputs, graph.packages);
			const imports = runtimeFindings(graph, runtime);
			const declarations = (yield* runtimeDeclarationProblems(inputs, graph.packages)).map(({ directory, message }) => ({
				file: directory === "." ? "package.json" : `${directory}/package.json`,
				line: 1,
				message,
				subject: "quality.runtime",
			}));
			const shared = inputs.sources.filter((file) => !isTestCode(file.path) && runtime(file.path) === "shared");
			if (shared.length === 0) {
				return [...imports, ...declarations];
			}
			const { browserGlobals } = yield* Effect.promise(() => import("#imports/browserGlobals.ts"));
			return [...imports, ...declarations, ...shared.flatMap(browserGlobals)];
		}),
	description:
		"Runtime folders define client, server and shared code. A manifest's quality.runtime declares a single-runtime package whole; executable packages without runtime folders and package-root tooling are server code.",
	id: "imports/runtime",
});
