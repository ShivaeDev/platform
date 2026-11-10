import ts from "typescript";
import { serviceProperty } from "#adapters/serviceAssemblySyntax.ts";
import { packageNameOf } from "#imports/packageName.ts";
import { boundaryReference } from "#rules/effect/boundaryReference.ts";

function rootIdentifier(expression: ts.Expression): ts.Identifier | undefined {
	if (ts.isIdentifier(expression)) {
		return expression;
	}
	return ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression) || ts.isCallExpression(expression)
		? rootIdentifier(expression.expression)
		: undefined;
}

function moduleOf(declaration: ts.Declaration): string | undefined {
	if (!(ts.isImportSpecifier(declaration) || ts.isNamespaceImport(declaration) || ts.isImportClause(declaration))) {
		return undefined;
	}
	const module = ts.findAncestor(declaration, ts.isImportDeclaration)?.moduleSpecifier;
	return module !== undefined && ts.isStringLiteral(module) ? module.text : undefined;
}

// Library types stay out of this rule's program, so a library's Promise is recognised by the bridge that consumes it, from its import.
export function promiseBridge(checker: ts.TypeChecker, workspace: ReadonlySet<string>) {
	function outsideLibrary(identifier: ts.Identifier): string | undefined {
		const specifier = (checker.getSymbolAtLocation(identifier)?.declarations ?? []).map(moduleOf).find((found) => found !== undefined);
		if (specifier === undefined || /^[.#/]/u.test(specifier)) {
			return undefined;
		}
		const name = packageNameOf(specifier);
		return name === "effect" || name.startsWith("@effect/") || name.startsWith("node:") || workspace.has(name) ? undefined : specifier;
	}
	function bridged(callback: ts.Node): string | undefined {
		const root = ts.isExpression(callback) && !ts.isFunctionLike(callback) ? rootIdentifier(callback) : undefined;
		const direct = root === undefined ? undefined : outsideLibrary(root);
		if (direct !== undefined) {
			return direct;
		}
		function visit(node: ts.Node): string | undefined {
			const callee = ts.isCallExpression(node) ? rootIdentifier(node.expression) : undefined;
			return (callee === undefined ? undefined : outsideLibrary(callee)) ?? ts.forEachChild(node, visit);
		}
		return ts.forEachChild(callback, visit);
	}
	return (node: ts.Node): string | undefined => {
		if (
			!(ts.isCallExpression(node) && /^effect(?:\.Effect|\/Effect)\.(?:tryPromise|promise)$/u.test(boundaryReference(checker, node.expression) ?? ""))
		) {
			return undefined;
		}
		const [argument] = node.arguments;
		const callback = argument !== undefined && ts.isObjectLiteralExpression(argument) ? serviceProperty(argument, "try") : argument;
		const library = callback === undefined ? undefined : bridged(callback);
		return library === undefined ? undefined : `Promise bridge to the library ${library}`;
	};
}
