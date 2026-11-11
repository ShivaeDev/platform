import { Effect } from "effect";
import { builtinName } from "#adapters/builtinName.ts";
import { callsDefineModule } from "#imports/callsDefineModule.ts";
import type { Endpoint } from "#imports/Endpoint.ts";
import { outgoing, walkFrom } from "#imports/fences/reach.ts";
import { followedEdges } from "#imports/generatedFolders.ts";
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

const MODULE_REPAIR = "Import the module's generated client from its generated folder instead; it holds no server code.";

interface Classified {
	readonly definedModules: ReadonlySet<string>;
	readonly runtime: (path: string) => Runtime | undefined;
}

interface Forbidden {
	readonly repair: string;
	readonly target: string;
}

function forbiddenTarget(from: Runtime, { definedModules, runtime }: Classified) {
	return (endpoint: Endpoint): Forbidden | undefined => {
		const to = endpoint.kind === "file" ? runtime(endpoint.path) : undefined;
		const builtin = endpoint.kind === "external" && builtinName(endpoint.specifier) !== undefined;
		if (!forbiddenImport(from, to, builtin)) {
			return undefined;
		}
		if (builtin) {
			return { repair: REPAIR, target: "Node built-in" };
		}
		return endpoint.kind === "file" && definedModules.has(endpoint.path)
			? { repair: MODULE_REPAIR, target: "a defined module, which is server code," }
			: { repair: REPAIR, target: `${to} code` };
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
function ignoredFindings(ignored: IgnoredReach, edge: ImportEdge, from: Runtime, classified: Classified) {
	if (edge.to.kind !== "file" || !ignored.modules.has(edge.to.path)) {
		return [];
	}
	return walkFrom(edge.to.path, ignored.edgesFrom, forbiddenTarget(from, classified)).reached.map(({ match, path }) => ({
		file: edge.from,
		line: edge.line,
		message: `${importer(from)} code reaches ${match.target} through "${edge.specifier}", which git ignores: ${path.join(" -> ")}. ${match.repair}`,
		subject: edge.specifier,
	}));
}

function runtimeFindings(graph: ImportGraph, generated: readonly string[], classified: Classified) {
	const ignored = { edgesFrom: outgoing(followedEdges(generated, graph.ignoredEdges)), modules: new Set(graph.ignoredModules) };
	return graph.edges.flatMap((edge) => {
		const from = classified.runtime(edge.from);
		if (from === undefined || isTestCode(edge.from)) {
			return [];
		}
		const forbidden = forbiddenTarget(from, classified)(edge.to);
		if (forbidden === undefined) {
			return ignoredFindings(ignored, edge, from, classified);
		}
		return [
			{
				file: edge.from,
				line: edge.line,
				message: `${importer(from)} code imports ${forbidden.target} through "${edge.specifier}". ${forbidden.repair}`,
				subject: edge.specifier,
			},
		];
	});
}

export const importsRuntime = defineRule({
	check: (inputs) =>
		Effect.gen(function* () {
			const graph = yield* importGraph(inputs);
			const definedModules = new Set(inputs.sources.filter(callsDefineModule).map((file) => file.path));
			const runtime = yield* runtimeOf(inputs, graph.packages, definedModules);
			const classified = { definedModules, runtime };
			const imports = [...runtimeFindings(graph, inputs.generated ?? [], classified), ...inputs.sources.flatMap(nodePlatformBarrels)];
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
