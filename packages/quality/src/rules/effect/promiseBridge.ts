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

function ownSpecifier(specifier: string, workspace: ReadonlySet<string>): boolean {
	if (/^[.#/]/u.test(specifier)) {
		return true;
	}
	const name = packageNameOf(specifier);
	return name === "effect" || name.startsWith("@effect/") || name.startsWith("@shivaedev/") || workspace.has(name);
}

function ownImport(callback: ts.Node, workspace: ReadonlySet<string>): boolean {
	const body = ts.isArrowFunction(callback) && ts.isExpression(callback.body) ? callback.body : undefined;
	const [specifier] = body !== undefined && ts.isCallExpression(body) && body.expression.kind === ts.SyntaxKind.ImportKeyword ? body.arguments : [];
	return specifier !== undefined && ts.isStringLiteralLike(specifier) && ownSpecifier(specifier.text, workspace);
}

function outsideLibrary(checker: ts.TypeChecker, workspace: ReadonlySet<string>) {
	return (identifier: ts.Identifier): string | undefined => {
		const specifier = (checker.getSymbolAtLocation(identifier)?.declarations ?? []).map(moduleOf).find((found) => found !== undefined);
		return specifier === undefined || specifier.startsWith("node:") || ownSpecifier(specifier, workspace) ? undefined : specifier;
	};
}

export const UNNAMED_BRIDGE = "a Promise bridge";

// Every Effect.promise or Effect.tryPromise turns a Promise into an Effect, whatever produced it. Only a bridge whose callback calls an imported library is named and reported; the others are adapters/ evidence, because a client typed by the repository's own interface or a dynamic import is accepted in core code. A dynamic import of the repository's own module or Effect only defers its evaluation and is no bridge.
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
		if (callback !== undefined && ownImport(callback, workspace)) {
			return undefined;
		}
		const found = callback === undefined ? undefined : bridged(callback);
		return found === undefined ? UNNAMED_BRIDGE : `Promise bridge to the library ${found}`;
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
