import ts from "typescript";
import { boundaryReference } from "./boundaryReference.ts";

export interface FailureOperation {
	readonly name: string;
	readonly node: ts.Node;
}

export function effectName(checker: ts.TypeChecker, node: ts.Node): string | undefined {
	return /^effect(?:\.Effect|\/Effect)\.(?<name>\w+)$/u.exec(boundaryReference(checker, node) ?? "")?.groups?.name;
}

export function failureOperations(checker: ts.TypeChecker, node: ts.Node, seen = new Set<ts.Symbol>()): FailureOperation[] {
	if (ts.isParenthesizedExpression(node)) {
		return failureOperations(checker, node.expression, seen);
	}
	if (ts.isIdentifier(node)) {
		const symbol = checker.getSymbolAtLocation(node);
		if (symbol !== undefined && !seen.has(symbol)) {
			seen.add(symbol);
			const declaration = symbol.valueDeclaration;
			if (declaration !== undefined && ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
				return failureOperations(checker, declaration.initializer, seen);
			}
		}
	}
	if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "pipe") {
		return [
			failureOperations(checker, node.expression.expression, seen),
			...node.arguments.map((part) => failureOperations(checker, part, new Set(seen))),
		].flat();
	}
	const name = effectName(checker, ts.isCallExpression(node) ? node.expression : node);
	if (name === undefined) {
		return [{ name: "source", node }];
	}
	const args = ts.isCallExpression(node) ? node.arguments : [];
	const first = args[0];
	return [...(first === undefined ? [] : failureOperations(checker, first, seen)), { name, node }];
}

function fileSystemService(checker: ts.TypeChecker, node: ts.Node, seen = new Set<ts.Symbol>()): boolean {
	if (/^effect(?:\.FileSystem|\/FileSystem)\.FileSystem$/u.test(boundaryReference(checker, node) ?? "")) {
		return true;
	}
	if (ts.isYieldExpression(node) || ts.isParenthesizedExpression(node)) {
		return node.expression !== undefined && fileSystemService(checker, node.expression, seen);
	}
	const symbol = checker.getSymbolAtLocation(node);
	if (symbol === undefined || seen.has(symbol)) {
		return false;
	}
	seen.add(symbol);
	return (symbol.declarations ?? []).some(
		(declaration) =>
			ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined && fileSystemService(checker, declaration.initializer, seen),
	);
}

export function fileSystemCall(checker: ts.TypeChecker, node: ts.Node): boolean {
	if (!ts.isCallExpression(node)) {
		return false;
	}
	const callee = node.expression;
	return (ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)) && fileSystemService(checker, callee.expression);
}
