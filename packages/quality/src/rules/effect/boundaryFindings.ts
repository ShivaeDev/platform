import ts from "typescript";
import type { Finding } from "#rule.ts";
import { boundaryCalls } from "#rules/effect/boundaryCalls.ts";
import { boundaryEntryPoint } from "#rules/effect/boundaryReference.ts";
import { promiseBridge } from "#rules/effect/promiseBridge.ts";
import { promiseParameter } from "#rules/effect/promiseParameter.ts";

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

// Bound without a program, the checker resolves only names declared in the module, so helpers imported from other modules and parameter types stay with the typed half.
export function boundaryFindings(checker: ts.TypeChecker, workspace: ReadonlySet<string>, typed: boolean) {
	const call = boundaryCalls(checker);
	const bridge = promiseBridge(checker, workspace);
	return (path: string, source: ts.SourceFile): readonly Finding[] => {
		const findings: Finding[] = [];
		const entryPoint = boundaryEntryPoint(path, source, checker);
		function visit(node: ts.Node): void {
			const name = construct(node) ?? call(node, entryPoint) ?? bridge(node) ?? (typed ? promiseParameter(checker, node) : undefined);
			if (name !== undefined) {
				findings.push({
					file: path,
					line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
					message: `Uses ${name}. Model the work with Effect; fail with a tagged error (or Effect.die for a defect). When a library forces it, move that code into a module under adapters/ that returns an Effect.`,
				});
			}
			ts.forEachChild(node, visit);
		}
		visit(source);
		return findings;
	};
}
