import { labelOf, outgoing, type Reached, type Trail, walkFrom } from "#imports/fences/reach.ts";
import type { ImportEdge, ImportGraph } from "#imports/graph.ts";
import { packageNameOf } from "#imports/resolve.ts";
import { isTestSupport } from "#naming/testName.ts";
import type { Finding, SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { usesDom } from "#rules/test-names/usesDom.ts";
import { engineOf } from "./engineOf.ts";
import { type Stand, standIns } from "./unitSyntax.ts";

const RELATIVE = /^[./#]/u;

const KIT = "Drive the engine through the package's story kit in a story, or, if the code under test is pure,";

function runtimeEdges(graph: ImportGraph): ReadonlyMap<string, readonly ImportEdge[]> {
	const packages = graph.unresolved
		.filter((request) => request.missing === undefined && !RELATIVE.test(request.specifier))
		.map((request) => ({ ...request, to: { kind: "external" as const, package: packageNameOf(request.specifier), specifier: request.specifier } }));
	return outgoing([...graph.edges, ...packages].filter((edge) => edge.kind === "import" && !edge.type));
}

function repair(path: readonly string[]): string {
	const [, first, ...rest] = path;
	if (first === undefined || rest.length === 0) {
		return "remove that import from the .unit file.";
	}
	return isTestSupport(first)
		? `give the .unit file fixtures from a test-support module that reaches no engine instead of ${first}.`
		: `split ${first}: move the pure code under test into its own module that reaches no engine, and test that module in the .unit file.`;
}

function reachFinding(file: string, reached: Reached<string>): Finding {
	return {
		file,
		line: reached.line,
		message: `Is a unit test but reaches ${reached.match} (${labelOf(reached.target)}) through ${reached.path.join(" -> ")}. A unit test reaches no engine, directly or through what it imports. ${KIT} ${repair(reached.path)}`,
	};
}

function standMessage(stand: Stand): string {
	return stand.why === "mocks"
		? `mocks with ${stand.what}. A unit test calls real code with real values and stands nothing in for a collaborator.`
		: `provides services with ${stand.what}. A unit test runs only requirement-free code, such as Effect.runSync on an Effect that needs nothing.`;
}

function where(file: string, module: string, trail: Trail): string {
	return module === file ? "" : ` in ${module}, which it imports through ${trail.path.join(" -> ")},`;
}

function syntaxFindings(file: string, module: string, trail: Trail, source: SourceFile | undefined): readonly Finding[] {
	const syntax = source === undefined ? undefined : parse(source);
	if (source === undefined || syntax === undefined) {
		return [];
	}
	function line(own: number): number {
		return module === file ? own : trail.line;
	}
	const stands = standIns(syntax).map((stand) => ({
		file,
		line: line(stand.line),
		message: `Is a unit test but${where(file, module, trail)} ${standMessage(stand)} ${KIT} test it in the .unit file without stand-ins.`,
	}));
	const dom = usesDom(source)
		? [
				{
					file,
					line: line(1),
					message: `Is a unit test but${where(file, module, trail)} uses the DOM. A unit test runs without one. ${KIT} test it in the .unit file without the DOM.`,
				},
			]
		: [];
	return [...stands, ...dom];
}

export function unitTests(graph: ImportGraph, sources: readonly SourceFile[]): (file: string) => readonly Finding[] {
	const edgesFrom = runtimeEdges(graph);
	const byPath = new Map(sources.map((source) => [source.path, source]));
	return (file) => {
		const walked = walkFrom(file, edgesFrom, engineOf);
		const checked = [...walked.visited].filter(([module]) => module === file || isTestSupport(module));
		return [
			...[...walked.reached].sort((a, b) => a.line - b.line).map((reached) => reachFinding(file, reached)),
			...checked.flatMap(([module, trail]) => syntaxFindings(file, module, trail, byPath.get(module))),
		];
	};
}
