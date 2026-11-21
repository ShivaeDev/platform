import ts from "typescript";
import type { ImportGraph } from "#imports/graph.ts";
import type { SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";

function usesBundler(source: ts.SourceFile): boolean {
	function visit(node: ts.Node): boolean {
		if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && ["esbuild", "rolldown"].includes(node.moduleSpecifier.text)) {
			return true;
		}
		if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Bun" && node.name.text === "build") {
			return true;
		}
		return ts.forEachChild(node, visit) ?? false;
	}
	return visit(source);
}

function directSources(files: readonly SourceFile[]): Map<string, ts.SourceFile> {
	const sources = new Map<string, ts.SourceFile>();
	for (const file of files) {
		if (!(file.text.includes("esbuild") || file.text.includes("rolldown") || file.text.includes("Bun"))) {
			continue;
		}
		const source = parse(file);
		if (source !== undefined && usesBundler(source)) {
			sources.set(file.path, source);
		}
	}
	return sources;
}

function fileEdges(graph: ImportGraph): readonly (readonly [from: string, to: string])[] {
	return graph.edges.flatMap((edge) => (!edge.type && edge.to.kind === "file" ? [[edge.from, edge.to.path] as const] : []));
}

function importedBy(graph: ImportGraph): ReadonlyMap<string, readonly string[]> {
	const importers = new Map<string, string[]>();
	for (const [from, to] of fileEdges(graph)) {
		importers.set(to, [...(importers.get(to) ?? []), from]);
	}
	return importers;
}

export function bundlerSources(files: readonly SourceFile[], graph: ImportGraph): ReadonlyMap<string, ts.SourceFile> {
	const filesByPath = new Map(files.map((file) => [file.path, file]));
	const sources = directSources(files);
	const importers = importedBy(graph);
	const pending = [...sources.keys()];
	while (pending.length > 0) {
		const path = pending.pop();
		for (const importer of importers.get(path ?? "") ?? []) {
			const file = filesByPath.get(importer);
			const source = sources.has(importer) || file === undefined ? undefined : parse(file);
			if (source !== undefined) {
				sources.set(importer, source);
				pending.push(importer);
			}
		}
	}
	return sources;
}

export function bundlerModules(
	sources: ReadonlyMap<string, ts.SourceFile>,
	files: readonly SourceFile[],
	graph: ImportGraph,
): ReadonlyMap<string, ts.SourceFile> {
	const filesByPath = new Map(files.map((file) => [file.path, file]));
	const modules = new Map(sources);
	for (const [from, to] of fileEdges(graph)) {
		const file = sources.has(from) && !modules.has(to) ? filesByPath.get(to) : undefined;
		const source = file === undefined ? undefined : parse(file);
		if (source !== undefined) {
			modules.set(to, source);
		}
	}
	return modules;
}
