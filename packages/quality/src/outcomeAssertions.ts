import ts from "typescript";
import { type ImportBinding, importBindings } from "#rules/stories/importBindings.ts";
import { memberName, unwrapped } from "#rules/stories/syntax.ts";

export interface OutcomeAssertion {
	readonly expected: ts.Expression;
	readonly negative: boolean;
	readonly node: ts.Node;
	readonly subject: string;
}

function receiver(node: ts.Expression): ts.Expression | undefined {
	const value = unwrapped(node);
	return ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value) ? unwrapped(value.expression) : undefined;
}

function imported(node: ts.Expression, name: string, modules: readonly string[], bindings: ReadonlyMap<string, ImportBinding>): boolean {
	const value = unwrapped(node);
	if (!ts.isIdentifier(value)) {
		return false;
	}
	const binding = bindings.get(value.text);
	return binding === undefined ? value.text === name : binding.imported === name && modules.includes(binding.module);
}

function subject(node: ts.Expression, checker: ts.TypeChecker): string | undefined {
	const value = unwrapped(node);
	if (ts.isYieldExpression(value)) {
		return value.expression === undefined ? undefined : subject(value.expression, checker);
	}
	if (ts.isIdentifier(value)) {
		const declaration = checker.getSymbolAtLocation(value)?.valueDeclaration;
		if (declaration !== undefined && ts.isVariableDeclaration(declaration) && declaration.initializer !== undefined) {
			return subject(declaration.initializer, checker);
		}
	}
	const named = ts.isCallExpression(value) ? unwrapped(value.expression) : value;
	const name = ts.isIdentifier(named) ? named.text : memberName(named);
	return name !== undefined && /outcome$/iu.test(name) ? value.getText() : undefined;
}

function assertion(node: ts.CallExpression, checker: ts.TypeChecker, bindings: ReadonlyMap<string, ImportBinding>): OutcomeAssertion | undefined {
	const matcher = memberName(node.expression);
	if (matcher === undefined || !["toBe", "toEqual", "toMatchObject"].includes(matcher)) {
		return;
	}
	let root = receiver(node.expression);
	const negative = root !== undefined && memberName(root) === "not";
	if (negative && root !== undefined) {
		root = receiver(root);
	}
	if (root === undefined || !ts.isCallExpression(root)) {
		return;
	}
	const callee = memberName(root.expression) === "soft" ? receiver(root.expression) : root.expression;
	const actual = root.arguments[0];
	const expected = node.arguments[0];
	const key = actual === undefined ? undefined : subject(actual, checker);
	if (
		callee !== undefined
		&& imported(callee, "expect", ["vitest", "@effect/vitest"], bindings)
		&& key !== undefined
		&& expected !== undefined
		&& (!negative || matcher !== "toMatchObject")
	) {
		return { expected, negative, node, subject: key };
	}
	return undefined;
}

function grouped(node: ts.CallExpression, checker: ts.TypeChecker, bindings: ReadonlyMap<string, ImportBinding>): readonly OutcomeAssertion[] {
	const rows = node.arguments[0];
	if (
		!imported(node.expression, "outcomes", ["@shivaedev/test-story/server/outcomes.ts"], bindings)
		|| rows === undefined
		|| !ts.isArrayLiteralExpression(rows)
	) {
		return [];
	}
	const assertions: OutcomeAssertion[] = [];
	for (const row of rows.elements) {
		if (!ts.isArrayLiteralExpression(row)) {
			continue;
		}
		const read = row.elements[1];
		const expected = row.elements[2];
		const key = read !== undefined && ts.isArrowFunction(read) && !ts.isBlock(read.body) ? subject(read.body, checker) : undefined;
		if (key !== undefined && expected !== undefined) {
			assertions.push({ expected, negative: false, node: row, subject: key });
		}
	}
	return assertions;
}

export function outcomeAssertions(body: ts.Node, checker: ts.TypeChecker): readonly OutcomeAssertion[] {
	const bindings = importBindings(body.getSourceFile());
	const assertions: OutcomeAssertion[] = [];
	function visit(node: ts.Node): void {
		if (ts.isFunctionLike(node) && node !== body) {
			return;
		}
		if (ts.isCallExpression(node)) {
			const direct = assertion(node, checker, bindings);
			assertions.push(...(direct === undefined ? [] : [direct]), ...grouped(node, checker, bindings));
		}
		ts.forEachChild(node, visit);
	}
	visit(body);
	return assertions;
}
