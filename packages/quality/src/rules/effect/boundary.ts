import { join } from "node:path";
import ts from "typescript";
import { defineRule, type Finding, type RuleInputs } from "#rule.ts";
import { boundaryCalls } from "#rules/effect/boundaryCalls.ts";
import { boundaryEntryPoint } from "#rules/effect/boundaryReference.ts";
import { effectProgram } from "#rules/effect/program.ts";
import { promiseParameter } from "#rules/effect/promiseParameter.ts";
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

function checkBoundary(inputs: RuleInputs): readonly Finding[] {
	const program = effectProgram(inputs, false);
	const checker = program.getTypeChecker();
	const call = boundaryCalls(checker);
	return inputs.sources.flatMap((file) => {
		if (/(?:^|\/)(?:adapters|test-support)\//u.test(file.path)) {
			return [];
		}
		const source = parse(file) === undefined ? undefined : program.getSourceFile(join(inputs.root, file.path));
		const findings: Finding[] = [];
		const entryPoint = source !== undefined && boundaryEntryPoint(file.path, source, checker);
		function visit(node: ts.Node): void {
			const name = construct(node) ?? call(node, entryPoint) ?? promiseParameter(checker, node);
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
	});
}

export const effectBoundary = defineRule({
	check: (inputs) => {
		const groups = new Map<string, RuleInputs["sources"][number][]>();
		for (const source of inputs.sources) {
			if (/(?:^|\/)(?:adapters|test-support)\//u.test(source.path) || !/\.[cm]?[jt]sx?$/u.test(source.path)) {
				continue;
			}
			const group = /^(?:packages|examples)\/[^/]+/u.exec(source.path)?.[0] ?? ".";
			const sources = groups.get(group) ?? [];
			sources.push(source);
			groups.set(group, sources);
		}
		return [...groups.values()].flatMap((sources) => checkBoundary({ ...inputs, sources }));
	},
	description:
		"Use Effect instead of Promise syntax and parameters, synchronous Node IO, throwing helper calls or Effect.sync with throwing APIs. Runners belong at entry points, tool configs and tests. Only adapters/ and test-support/ folders are exempt. Use Effect services and tagged errors; bridge outside libraries in adapters/. No config exceptions or inline suppressions; baseline existing debt.",
	id: "effect/boundary",
	registrable: false,
});
