import { Effect } from "effect";
import ts from "typescript";
import { importGraph } from "#imports/graph.ts";
import { isTestSupport } from "#naming/testName.ts";
import type { Finding, RuleInputs, SourceFile, TypeScriptProgram } from "#rule.ts";
import { nodesWhere } from "#rules/stories/syntax.ts";

function boundaryName(declaration: ts.Declaration | undefined): string | undefined {
	if (declaration === undefined || !ts.isFunctionDeclaration(declaration)) {
		return undefined;
	}
	const name = declaration.name?.text;
	const path = declaration.getSourceFile().fileName.replaceAll("\\", "/");
	return /\/(?:@shivaedev\/)?errors\/(?:src|dist)\/(?:boundary|rpcBoundaryHandlers)\.(?:d\.)?ts$/u.test(path)
		&& (name === "rpcBoundary" || name === "rpcBoundaryHandlers")
		? name
		: undefined;
}

function handlerBuilder(declaration: ts.Declaration | undefined): boolean {
	if (declaration === undefined) {
		return false;
	}
	const path = declaration.getSourceFile().fileName.replaceAll("\\", "/");
	return (
		ts.isMethodSignature(declaration)
		&& ["toLayer", "toLayerHandler", "toHandlers", "of"].includes(declaration.name.getText())
		&& /\/effect\/(?:src|dist(?:\/dts)?)\/(?:unstable\/)?rpc\/RpcGroup\.(?:d\.)?ts$/u.test(path)
	);
}

function checkSources(sources: readonly SourceFile[], { checker, sourceFile }: TypeScriptProgram): readonly Finding[] {
	return sources.flatMap((file) => {
		const source = sourceFile(file.path);
		if (source === undefined) {
			return [];
		}
		const calls = nodesWhere(source, ts.isCallExpression)
			.filter(ts.isCallExpression)
			.map((call) => ({ call, declaration: checker.getTypeAtLocation(call.expression).getCallSignatures()[0]?.getDeclaration() }));
		if (
			calls.some(({ declaration }) => handlerBuilder(declaration))
			|| source.statements.some((statement) => ts.isFunctionDeclaration(statement) && boundaryName(statement) === "rpcBoundaryHandlers")
		) {
			return [];
		}
		return calls.flatMap(({ call, declaration }): readonly Finding[] => {
			const name = boundaryName(declaration);
			return name === undefined
				? []
				: [
						{
							file: file.path,
							line: source.getLineAndCharacterOfPosition(call.getStart(source)).line + 1,
							message: `Uses ${name} outside a module that builds RPC handlers. Move the boundary into the module calling the RPC group's toLayer, toLayerHandler, toHandlers or of; services must keep their own typed failures.`,
						},
					];
		});
	});
}

export const rpcBoundaryCheck = Effect.fn("RpcBoundary.rpcBoundaryCheck")(function* (inputs: RuleInputs) {
	const candidates = new Set(inputs.sources.filter((source) => source.text.includes("rpcBoundary")).map((source) => source.path));
	const graph = candidates.size === 0 ? undefined : yield* importGraph(inputs);
	const importers = new Map<string, string[]>();
	for (const edge of graph?.edges ?? []) {
		if (edge.to.kind === "file" && !edge.type) {
			const paths = importers.get(edge.to.path) ?? [];
			paths.push(edge.from);
			importers.set(edge.to.path, paths);
		}
	}
	for (const path of candidates) {
		for (const importer of importers.get(path) ?? []) {
			candidates.add(importer);
		}
	}
	return {
		checks: (source: SourceFile) => !isTestSupport(source.path) && /\.[cm]?[jt]sx?$/u.test(source.path) && candidates.has(source.path),
		findings: checkSources,
	};
});
