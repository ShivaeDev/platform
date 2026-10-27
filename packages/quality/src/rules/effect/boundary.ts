import ts from "typescript";
import { defineRule, type Finding } from "#rule.ts";
import { parse } from "#rules/parse.ts";

function asyncConstruct(node: ts.Node): string | undefined {
	if (
		!(ts.isFunctionLike(node) && ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword))
	) {
		return undefined;
	}
	if (ts.isArrowFunction(node)) {
		return "async arrow";
	}
	return ts.isMethodDeclaration(node) ? "async method" : "async function";
}

function thenCall(node: ts.Node): boolean {
	if (!ts.isCallExpression(node)) {
		return false;
	}
	const callee = node.expression;
	return (
		(ts.isPropertyAccessExpression(callee) && callee.name.text === "then")
		|| (ts.isElementAccessExpression(callee) && ts.isStringLiteral(callee.argumentExpression) && callee.argumentExpression.text === "then")
	);
}

function construct(node: ts.Node): string | undefined {
	if (ts.isVariableDeclarationList(node) && (node.flags & ts.NodeFlags.AwaitUsing) === ts.NodeFlags.AwaitUsing) {
		return "await";
	}
	if (ts.isAwaitExpression(node) || (ts.isForOfStatement(node) && node.awaitModifier !== undefined)) {
		return "await";
	}
	if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "Promise") {
		return "new Promise(...)";
	}
	if (thenCall(node)) {
		return ".then(...)";
	}
	if (ts.isTryStatement(node)) {
		return "try statement";
	}
	return ts.isThrowStatement(node) ? "throw statement" : asyncConstruct(node);
}

export const effectBoundary = defineRule({
	check: ({ sources }) =>
		sources.flatMap((file) => {
			if (/(?:^|\/)(?:adapters|test-support)\//u.test(file.path)) {
				return [];
			}
			const source = parse(file);
			const findings: Finding[] = [];
			function visit(node: ts.Node): void {
				const name = construct(node);
				if (name !== undefined && source !== undefined) {
					findings.push({
						file: file.path,
						line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
						message: `Uses ${name}. Model the work with Effect; fail with a tagged error (or Effect.die for a defect). Move a bridge to an outside library into an adapters/ folder, returning Effect values.`,
					});
				}
				ts.forEachChild(node, visit);
			}
			if (source !== undefined) {
				visit(source);
			}
			return findings;
		}),
	description:
		"All checked source, tooling and specs use Effect instead of async, await, new Promise, .then, try or throw. Only adapters/ and test-support/ folders at any depth are exempt. adapters/ bridges outside libraries to Effect; it remains subject to service-parameter and ambient runtime bans. Use tagged errors or Effect.die for defects. Config exceptions and inline suppressions are refused; baseline existing debt.",
	id: "effect/boundary",
	registrable: false,
});
