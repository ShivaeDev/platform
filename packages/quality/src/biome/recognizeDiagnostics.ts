import { resolve } from "node:path";
import ts from "typescript";
import { browserDiagnostic } from "#adapters/biome/browserDiagnostic.ts";
import { syntaxOf } from "#adapters/biome/syntaxOf.ts";
import { vitestEntry } from "#adapters/biome/vitestEntry.ts";
import { nativeEffectCall } from "./nativeEffectCall.ts";
import type { Diagnostic } from "./report.ts";
import { nodeAt, offsetOf, type Syntax } from "./syntax.ts";

const RECOGNIZED: ReadonlySet<string> = new Set(["lint/correctness/noComponentHookFactories", "lint/style/noDoneCallback"]);

function generatorParameter(node: ts.Node, syntax: Syntax): boolean {
	const parameter = node.parent;
	const callback = parameter.parent;
	return (
		ts.isParameter(parameter)
		&& parameter.name === node
		&& ts.isFunctionExpression(callback)
		&& callback.asteriskToken !== undefined
		&& ts.isCallExpression(callback.parent)
		&& callback.parent.arguments.includes(callback)
		&& !vitestEntry(callback.parent.expression, syntax)
	);
}

function tagHandler(node: ts.Node, syntax: Syntax): boolean {
	const property = node.parent;
	if (
		!(ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property))
		|| property.name !== node
		|| !ts.isObjectLiteralExpression(property.parent)
	) {
		return false;
	}
	const handlers = property.parent;
	const call = handlers.parent;
	return nativeEffectCall(call, "catchTags", syntax) && call.arguments.includes(handlers);
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
			return generatorParameter(node, syntax);
		case "lint/correctness/noComponentHookFactories":
			return tagHandler(node, syntax);
		default:
			return false;
	}
}

export function recognizeDiagnostics(root: string, diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
	const sources = new Map<string, Syntax>();
	return diagnostics.flatMap((diagnostic) => {
		const path = diagnostic.location.path;
		if (diagnostic.category === "lint/suspicious/useBaseline" && path !== undefined) {
			const recognized = browserDiagnostic(diagnostic, resolve(root, path));
			return recognized === undefined ? [] : [recognized];
		}
		if (!RECOGNIZED.has(diagnostic.category ?? "") || path === undefined) {
			return [diagnostic];
		}
		const file = resolve(root, path);
		const syntax = sources.get(file) ?? syntaxOf(file);
		sources.set(file, syntax);
		return misclassified(diagnostic, syntax) ? [] : [diagnostic];
	});
}
