import ts from "typescript";
import { packageNameOf } from "#imports/packageName.ts";
import { boundaryReference } from "#rules/effect/boundaryReference.ts";
import { serviceProperty } from "#serviceAssemblySyntax.ts";

function rootIdentifier(expression: ts.Expression): ts.Identifier | undefined {
	if (ts.isIdentifier(expression)) {
		return expression;
	}
	return ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression) || ts.isCallExpression(expression)
		? rootIdentifier(expression.expression)
		: undefined;
}

function calleeOf(node: ts.Node): ts.Identifier | undefined {
	if (ts.isTaggedTemplateExpression(node)) {
		return rootIdentifier(node.tag);
	}
	return ts.isCallExpression(node) ? rootIdentifier(node.expression) : undefined;
}

function moduleOf(declaration: ts.Declaration): string | undefined {
	if (!(ts.isImportSpecifier(declaration) || ts.isNamespaceImport(declaration) || ts.isImportClause(declaration))) {
		return undefined;
	}
	const module = ts.findAncestor(declaration, ts.isImportDeclaration)?.moduleSpecifier;
	return module !== undefined && ts.isStringLiteral(module) ? module.text : undefined;
}

function bridgeCall(checker: ts.TypeChecker, node: ts.Node): boolean {
	return (
		ts.isCallExpression(node) && /^effect(?:\.Effect|\/Effect)\.(?:tryPromise|promise)$/u.test(boundaryReference(checker, node.expression) ?? "")
	);
}

function callbackOf(node: ts.CallExpression): ts.Node | undefined {
	const [argument] = node.arguments;
	return argument !== undefined && ts.isObjectLiteralExpression(argument) ? serviceProperty(argument, "try") : argument;
}

function outsideLibrary(checker: ts.TypeChecker, workspace: ReadonlySet<string>) {
	return (identifier: ts.Identifier): string | undefined => {
		const specifier = (checker.getSymbolAtLocation(identifier)?.declarations ?? []).map(moduleOf).find((found) => found !== undefined);
		if (specifier === undefined || /^[.#/]/u.test(specifier)) {
			return undefined;
		}
		const name = packageNameOf(specifier);
		return name === "effect" || name.startsWith("@effect/") || name.startsWith("@shivaedev/") || name.startsWith("node:") || workspace.has(name)
			? undefined
			: specifier;
	};
}

// The syntax half sees a library's Promise only through the bridge that consumes it, from the import its callback calls.
export function promiseBridge(checker: ts.TypeChecker, workspace: ReadonlySet<string>) {
	const library = outsideLibrary(checker, workspace);
	function bridged(callback: ts.Node): string | undefined {
		const root = ts.isExpression(callback) && !ts.isFunctionLike(callback) ? rootIdentifier(callback) : undefined;
		const direct = root === undefined ? undefined : library(root);
		if (direct !== undefined) {
			return direct;
		}
		function visit(node: ts.Node): string | undefined {
			const callee = calleeOf(node);
			return (callee === undefined ? undefined : library(callee)) ?? ts.forEachChild(node, visit);
		}
		return ts.forEachChild(callback, visit);
	}
	return (node: ts.Node): string | undefined => {
		if (!(ts.isCallExpression(node) && bridgeCall(checker, node))) {
			return undefined;
		}
		const callback = callbackOf(node);
		const found = callback === undefined ? undefined : bridged(callback);
		return found === undefined ? undefined : `Promise bridge to the library ${found}`;
	};
}

// A call inside a bridge callback whose callee is an imported library binding is the one the bridge finding already names.
export function bridgedLibraryCall(checker: ts.TypeChecker, workspace: ReadonlySet<string>) {
	const library = outsideLibrary(checker, workspace);
	return (node: ts.CallExpression): boolean => {
		const callee = calleeOf(node);
		if (callee === undefined || library(callee) === undefined) {
			return false;
		}
		const bridge = ts.findAncestor(node.parent, (ancestor) => bridgeCall(checker, ancestor));
		const callback = bridge !== undefined && ts.isCallExpression(bridge) ? callbackOf(bridge) : undefined;
		return callback !== undefined && callback.pos <= node.pos && node.end <= callback.end;
	};
}
