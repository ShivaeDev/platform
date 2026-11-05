import ts from "typescript";
import { type RuntimeName, runtimeImport, runtimeOf } from "./runtimeImports.ts";

function moduleRuntime(node: ts.Node): string | undefined {
	if (ts.isImportDeclaration(node) && node.importClause === undefined && ts.isStringLiteral(node.moduleSpecifier)) {
		return runtimeOf(runtimeImport(node.moduleSpecifier.text, []));
	}
	if (
		!(
			ts.isExportDeclaration(node)
			&& node.exportClause === undefined
			&& node.moduleSpecifier !== undefined
			&& ts.isStringLiteral(node.moduleSpecifier)
		)
	) {
		return undefined;
	}
	const module = node.moduleSpecifier.text;
	if (module === "effect" || module === "effect/Effect") {
		return module === "effect" ? "Clock" : "Effect.run*";
	}
	return runtimeOf(runtimeImport(module, []));
}

function exportedVariable(node: ts.Node): boolean {
	return (
		ts.isVariableDeclaration(node)
		&& ts.isVariableStatement(node.parent.parent)
		&& node.parent.parent.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true
	);
}

function runtimeAt(node: ts.Node, origin: (node: ts.Node) => RuntimeName | undefined): string | undefined {
	const fromModule = moduleRuntime(node);
	if (fromModule !== undefined) {
		return fromModule;
	}
	if (ts.isCallExpression(node)) {
		return runtimeOf(origin(node.expression)) ?? runtimeOf(origin(node));
	}
	const name = origin(node);
	if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isExportSpecifier(node) || exportedVariable(node)) {
		return runtimeOf(name);
	}
	return name?.module === "effect" && ["Clock", "TestClock"].includes(name.path[0] ?? "") ? runtimeOf(name) : undefined;
}

export interface RuntimeUse {
	readonly line: number;
	readonly what: string;
}

export function firstRuntimeUse(source: ts.SourceFile, origin: (node: ts.Node) => RuntimeName | undefined): RuntimeUse | undefined {
	let first: RuntimeUse | undefined;
	function visit(node: ts.Node): void {
		if (
			first !== undefined
			|| ts.isTypeNode(node)
			|| (ts.isImportClause(node) && node.isTypeOnly)
			|| (ts.isExportDeclaration(node) && node.isTypeOnly)
		) {
			return;
		}
		const what = runtimeAt(node, origin);
		if (what !== undefined) {
			first = { line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, what };
			return;
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return first;
}
