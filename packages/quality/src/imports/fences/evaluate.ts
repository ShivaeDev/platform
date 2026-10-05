import type { ImportEdge, ImportGraph } from "#imports/graph.ts";
import { isTestCode } from "#naming/testName.ts";
import type { Finding } from "#rule.ts";
import { type Compiler, compile, type Matcher } from "./match.ts";
import type { Fence } from "./model.ts";
import { labelOf, outgoing, reachedFrom } from "./reach.ts";
import { compileVocabulary, type Vocabulary } from "./vocabulary.ts";

export type FenceGraph = Pick<ImportGraph, "edges" | "modules">;

export type Evaluate = (graph: FenceGraph) => readonly Finding[];

export interface CompiledFence {
	readonly evaluate: Evaluate;
	readonly fence: Fence;
}

function across(fence: Fence): string {
	return `across the fence "${fence.name}": ${fence.rationale}`;
}

function vocabularyFinding(fence: Fence, vocabulary: Vocabulary, subjects: readonly string[], edge: ImportEdge): readonly Finding[] {
	const subject = vocabulary.subjectOf(edge.to);
	if (subject === undefined || subjects.includes(subject)) {
		return [];
	}
	const message = `Imports "${subject}" of ${vocabulary.folder} ${across(fence)} Use only ${subjects.join(", ")}.`;
	return [{ file: edge.from, line: edge.line, message, subject: fence.name }];
}

function vocabularyFindings(compiler: Compiler, fence: Fence, importer: (path: string) => boolean, where: string): Evaluate {
	if (fence.prohibition.kind !== "vocabulary") {
		return () => [];
	}
	const subjects = fence.prohibition.subjects;
	const vocabulary = compileVocabulary(compiler, fence.prohibition.unit, subjects, `${where}.of`);
	if (vocabulary === undefined) {
		return () => [];
	}
	return (graph) => graph.edges.flatMap((edge) => (importer(edge.from) ? vocabularyFinding(fence, vocabulary, subjects, edge) : []));
}

function importFindings(fence: Fence, importer: (path: string) => boolean, to: Matcher): Evaluate {
	return (graph) =>
		graph.edges
			.filter((edge) => importer(edge.from) && to(edge.to))
			.map((edge) => ({ file: edge.from, line: edge.line, message: `Imports ${labelOf(edge.to)} ${across(fence)}`, subject: fence.name }));
}

function reachFindings(fence: Fence, importer: (path: string) => boolean, to: Matcher): Evaluate {
	return (graph) => {
		const edgesFrom = outgoing(graph.edges);
		return graph.modules.filter(importer).flatMap((module) =>
			reachedFrom(module, edgesFrom, to).map((reached) => ({
				file: module,
				line: reached.line,
				message: `Reaches ${labelOf(reached.target)} through ${reached.path.join(" -> ")} ${across(fence)}`,
				subject: fence.name,
			})),
		);
	};
}

export function compileFence(compiler: Compiler, fence: Fence): CompiledFence {
	const where = `fence "${fence.name}"`;
	const from = compile(compiler, fence.from, `${where}.from`);
	function importer(path: string): boolean {
		return !isTestCode(path) && from({ kind: "file", path });
	}
	const prohibition = fence.prohibition;
	if (prohibition.kind === "vocabulary") {
		return { evaluate: vocabularyFindings(compiler, fence, importer, where), fence };
	}
	const to = compile(compiler, prohibition.to, `${where}.to`);
	return { evaluate: prohibition.kind === "import" ? importFindings(fence, importer, to) : reachFindings(fence, importer, to), fence };
}
