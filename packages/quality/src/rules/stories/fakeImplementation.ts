import ts from "typescript";
import type { fakeReferences } from "#adapters/imports/fakeReferences.ts";
import { memberName, unwrapped } from "#rules/stories/syntax.ts";

export function fakeImplementation(expression: ts.Expression, references: ReturnType<typeof fakeReferences>, seen = new Set<ts.Node>()): boolean {
	const node = unwrapped(expression);
	if (seen.has(node) || references.owner(node) !== undefined) {
		return false;
	}
	seen.add(node);
	if (ts.isObjectLiteralExpression(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
		return true;
	}
	if (ts.isCallExpression(node)) {
		const name = memberName(node.expression);
		if (name === "of" || name === "succeed" || name === "sync" || name === "map" || name === "gen") {
			return node.arguments.some((argument) => fakeImplementation(argument, references, seen));
		}
		return name === "fail" || name === "die" || name === "fn";
	}
	const value = references.initializer(node);
	return value !== undefined && fakeImplementation(value, references, seen);
}
