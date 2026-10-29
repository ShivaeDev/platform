import { resolve } from "node:path";
import ts from "typescript";
import { nativeEffectCall } from "./nativeEffectCall.ts";
import type { Diagnostic } from "./report.ts";
import { nodeAt, offsetOf, type Syntax, syntaxOf } from "./syntax.ts";

const RECOGNIZED: ReadonlySet<string> = new Set(["lint/correctness/noComponentHookFactories", "lint/style/noDoneCallback"]);

function generatorParameter(node: ts.Node): boolean {
	const parameter = node.parent;
	const callback = parameter.parent;
	return (
		ts.isParameter(parameter)
		&& parameter.name === node
		&& ts.isFunctionExpression(callback)
		&& callback.asteriskToken !== undefined
		&& ts.isCallExpression(callback.parent)
		&& callback.parent.arguments.includes(callback)
	);
}

function tagHandler(node: ts.Node, syntax: Syntax): boolean {
	const property = node.parent;
	if (!ts.isPropertyAssignment(property) || property.name !== node || !ts.isObjectLiteralExpression(property.parent)) {
		return false;
	}
	const handlers = property.parent;
	const call = handlers.parent;
	return (
		nativeEffectCall(call, "catchTags", syntax)
		&& call.arguments.includes(handlers)
		&& ts.isArrowFunction(property.initializer)
		&& nativeEffectCall(property.initializer.body, "fail", syntax)
	);
}

function misclassified(diagnostic: Diagnostic, syntax: Syntax): boolean {
	const { start, end } = diagnostic.location;
	const from = start === undefined ? undefined : offsetOf(syntax.source, start);
	const to = end === undefined ? undefined : offsetOf(syntax.source, end);
	const node = from === undefined || to === undefined ? undefined : nodeAt(syntax.source, from, to);
	if (node === undefined) {
		return false;
	}
	switch (diagnostic.category) {
		case "lint/style/noDoneCallback":
			return generatorParameter(node);
		case "lint/correctness/noComponentHookFactories":
			return tagHandler(node, syntax);
		default:
			return false;
	}
}

export function recognizeDiagnostics(root: string, diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
	const sources = new Map<string, Syntax>();
	return diagnostics.filter((diagnostic) => {
		const path = diagnostic.location.path;
		if (!RECOGNIZED.has(diagnostic.category ?? "") || path === undefined) {
			return true;
		}
		const file = resolve(root, path);
		const syntax = sources.get(file) ?? syntaxOf(file);
		sources.set(file, syntax);
		return !misclassified(diagnostic, syntax);
	});
}
