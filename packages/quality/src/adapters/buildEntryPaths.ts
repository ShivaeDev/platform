import { posix } from "node:path";
import ts from "typescript";
import { type BuildBindings, buildEntryValue, buildOption } from "#adapters/buildEntryValue.ts";
import { importedCall } from "#adapters/importedCall.ts";

function pathFromCall(node: ts.CallExpression, cwd: string, paths: (expression: ts.Expression) => readonly string[]): readonly string[] {
	if (node.expression.getText() === "process.cwd" && node.arguments.length === 0) {
		return [cwd];
	}
	const imported = importedCall(node);
	if (imported === undefined || !/^(?:node:)?path$/u.test(imported.module) || (imported.name !== "join" && imported.name !== "resolve")) {
		return [];
	}
	const parts = node.arguments.map(paths);
	if (parts.some((part) => part.length !== 1)) {
		return [];
	}
	const values = parts.flat();
	return [imported.name === "resolve" ? posix.resolve(cwd, ...values) : posix.join(...values)];
}

function valuesOf(node: ts.Expression): readonly ts.Expression[] {
	if (ts.isArrayLiteralExpression(node)) {
		return node.elements;
	}
	if (!ts.isObjectLiteralExpression(node)) {
		return [];
	}
	const input = buildOption(node, "in");
	return input === undefined ? node.properties.flatMap((property) => (ts.isPropertyAssignment(property) ? [property.initializer] : [])) : [input];
}

export function buildEntryPaths(
	expression: ts.Expression,
	cwd: string,
	file: string,
	active: ReadonlySet<ts.Node> = new Set(),
	bindings: BuildBindings = new Map(),
): readonly string[] {
	const node = buildEntryValue(expression, new Set(), bindings);
	if (active.has(node)) {
		return [];
	}
	const visited = new Set([...active, node]);
	function paths(value: ts.Expression) {
		return buildEntryPaths(value, cwd, file, visited, bindings);
	}
	if (ts.isStringLiteralLike(node)) {
		return [node.text];
	}
	if (ts.isSpreadElement(node)) {
		return paths(node.expression);
	}
	if (
		(ts.isIdentifier(node) && node.text === "__dirname")
		|| (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.MetaProperty && node.name.text === "dirname")
	) {
		return [posix.dirname(file)];
	}
	return ts.isCallExpression(node) ? pathFromCall(node, cwd, paths) : valuesOf(node).flatMap(paths);
}
