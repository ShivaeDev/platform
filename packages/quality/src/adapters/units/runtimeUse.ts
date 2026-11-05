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

function runtimeAt(node: ts.Node, origin: (node: ts.Node) => RuntimeName | undefined): string | undefined {
	const fromModule = moduleRuntime(node);
	if (fromModule !== undefined) {
		return fromModule;
	}
	if (ts.isCallExpression(node)) {
		return runtimeOf(origin(node.expression)) ?? runtimeOf(origin(node));
	}
	return runtimeOf(origin(node));
}

export interface RuntimeUse {
	readonly line: number;
	readonly what: string;
}

function typeOnly(node: ts.Node): boolean {
	if (ts.isTypeNode(node)) {
		return true;
	}
	return ts.isImportClause(node)
		|| ts.isExportDeclaration(node)
		|| ts.isImportEqualsDeclaration(node)
		|| ts.isImportSpecifier(node)
		|| ts.isExportSpecifier(node)
		? node.isTypeOnly
		: false;
}

export function firstRuntimeUse(source: ts.SourceFile, origin: (node: ts.Node) => RuntimeName | undefined): RuntimeUse | undefined {
	let first: RuntimeUse | undefined;
	function visit(node: ts.Node): void {
		if (first !== undefined || typeOnly(node) || (ts.isIdentifier(node) && ts.isImportClause(node.parent))) {
			return;
		}
		const what = runtimeAt(node, origin);
		if (what !== undefined) {
			first = { line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, what };
			return;
		}
		if (ts.isImportSpecifier(node) || ts.isNamespaceImport(node) || ts.isImportEqualsDeclaration(node) || ts.isExportSpecifier(node)) {
			return;
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return first;
}
