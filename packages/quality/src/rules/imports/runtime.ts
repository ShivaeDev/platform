import { Effect } from "effect";
import { builtinName } from "#adapters/builtinName.ts";
import type { Endpoint } from "#imports/Endpoint.ts";
import { outgoing, walkFrom } from "#imports/fences/reach.ts";
import { type ImportEdge, type ImportGraph, importGraph } from "#imports/graph.ts";
import { nodePlatformBarrels } from "#imports/nodePlatformBarrels.ts";
import { type Runtime, runtimeDeclarationProblems, runtimeOf } from "#imports/runtime.ts";
import { isTestCode } from "#naming/testName.ts";
import { defineRule } from "#rule.ts";

function forbiddenImport(from: Runtime, to: Runtime | undefined, builtin: boolean): boolean {
	if (from === "shared") {
		return to === "client" || to === "server" || builtin;
	}
	return from === "client" && (to === "server" || builtin);
}

const REPAIR = "Move runtime-dependent code into src/client/ or src/server/ and keep shared code independent of both runtimes.";

function forbiddenTarget(from: Runtime, runtime: (path: string) => Runtime | undefined) {
	return (endpoint: Endpoint): string | undefined => {
		const to = endpoint.kind === "file" ? runtime(endpoint.path) : undefined;
		const builtin = endpoint.kind === "external" && builtinName(endpoint.specifier) !== undefined;
		if (!forbiddenImport(from, to, builtin)) {
			return undefined;
		}
		return builtin ? "Node built-in" : `${to} code`;
	};
}

function importer(from: Runtime): string {
	return from === "client" ? "Client" : "Shared";
}

interface IgnoredReach {
	readonly edgesFrom: ReadonlyMap<string, readonly ImportEdge[]>;
	readonly modules: ReadonlySet<string>;
}

// An ignored module, such as generated output, is never reported itself, so its forbidden imports land on the checked file that reaches them.
function ignoredFindings(ignored: IgnoredReach, edge: ImportEdge, from: Runtime, runtime: (path: string) => Runtime | undefined) {
	if (edge.to.kind !== "file" || !ignored.modules.has(edge.to.path)) {
		return [];
	}
	return walkFrom(edge.to.path, ignored.edgesFrom, forbiddenTarget(from, runtime)).reached.map((reached) => ({
		file: edge.from,
		line: edge.line,
		message: `${importer(from)} code reaches ${reached.match} through "${edge.specifier}", which git ignores: ${reached.path.join(" -> ")}. ${REPAIR}`,
		subject: edge.specifier,
	}));
}

function runtimeFindings(graph: ImportGraph, runtime: (path: string) => Runtime | undefined) {
	const ignored = { edgesFrom: outgoing(graph.ignoredEdges), modules: new Set(graph.ignoredModules) };
	return graph.edges.flatMap((edge) => {
		const from = runtime(edge.from);
		if (from === undefined || isTestCode(edge.from)) {
			return [];
		}
		const forbidden = forbiddenTarget(from, runtime)(edge.to);
		if (forbidden === undefined) {
			return ignoredFindings(ignored, edge, from, runtime);
		}
		return [
			{
				file: edge.from,
				line: edge.line,
				message: `${importer(from)} code imports ${forbidden} through "${edge.specifier}". ${REPAIR}`,
				subject: edge.specifier,
			},
		];
	});
}

export const importsRuntime = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const graph = yield* importGraph(inputs);
			const runtime = yield* runtimeOf(inputs, graph.packages);
			const imports = [...runtimeFindings(graph, runtime), ...inputs.sources.flatMap(nodePlatformBarrels)];
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
			return [...imports, ...declarations, ...(yield* browserGlobals(shared))];
		}),
	description:
		"Runtime folders define client, server and shared code. A manifest's quality.runtime declares a single-runtime package whole; executable packages without runtime folders and package-root tooling are server code. Production imports use @effect/platform-node module subpaths so its barrel does not load optional integrations.",
	id: "imports/runtime",
});
