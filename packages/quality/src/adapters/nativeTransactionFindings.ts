import { join } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { transactionChanges } from "#adapters/transactionChanges.ts";
import type { Finding, RuleInputs } from "#rule.ts";
import { effectProgram } from "#rules/effect/program.ts";
import { parse } from "#rules/parse.ts";
import { memberName, nodesWhere, unwrapped } from "#rules/stories/syntax.ts";

function candidates(source: ts.SourceFile): readonly ts.Node[] {
	const aliases = new Set(["withTransaction"]);
	for (const node of nodesWhere(source, (candidate) => ts.isVariableDeclaration(candidate) || ts.isBindingElement(candidate))) {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
			const value = unwrapped(node.initializer);
			if (memberName(value) === "withTransaction" || (ts.isIdentifier(value) && aliases.has(value.text))) {
				aliases.add(node.name.text);
			}
		}
		if (ts.isBindingElement(node) && node.propertyName?.getText() === "withTransaction" && ts.isIdentifier(node.name)) {
			aliases.add(node.name.text);
		}
	}
	function reference(expression: ts.Expression): boolean {
		const value = unwrapped(expression);
		return memberName(value) === "withTransaction" || (ts.isIdentifier(value) && aliases.has(value.text));
	}
	return nodesWhere(source, (node) => ts.isCallExpression(node) && (reference(node.expression) || node.arguments.some(reference)));
}

function nativeTransaction(checker: ts.TypeChecker, expression: ts.Expression): boolean {
	const value = unwrapped(expression);
	if (!ts.isIdentifier(value) && memberName(value) !== "withTransaction") {
		return false;
	}
	const signature = checker.getTypeAtLocation(value).getCallSignatures()[0];
	const declaration = signature?.getDeclaration();
	if (declaration === undefined) {
		return false;
	}
	const path = declaration.getSourceFile().fileName.replaceAll("\\", "/");
	return (
		/\/effect\/(?:src|dist(?:\/dts)?)\/sql\/SqlClient\.(?:d\.)?ts$/u.test(path)
		&& ts.isPropertySignature(declaration.parent)
		&& declaration.parent.name.getText() === "withTransaction"
	);
}

function changedBodies(checker: ts.TypeChecker, call: ts.CallExpression): readonly ts.Expression[] {
	if (nativeTransaction(checker, call.expression)) {
		return call.arguments.slice(0, 1);
	}
	const callee = unwrapped(call.expression);
	const index = call.arguments.findIndex((argument) => nativeTransaction(checker, argument));
	if (index < 0) {
		return [];
	}
	if (ts.isPropertyAccessExpression(callee) && callee.name.text === "pipe") {
		return [callee.expression, ...call.arguments.slice(0, index)];
	}
	const declaration = checker.getResolvedSignature(call)?.getDeclaration();
	return declaration !== undefined && /\/effect\/(?:src|dist(?:\/dts)?)\/Function\.(?:d\.)?ts$/u.test(declaration.getSourceFile().fileName)
		? call.arguments.slice(0, index)
		: [];
}

function findingsIn(inputs: RuleInputs): readonly Finding[] {
	const program = effectProgram(inputs);
	const checker = program.getTypeChecker();
	return inputs.sources.flatMap((file) => {
		const source = program.getSourceFile(join(inputs.root, file.path));
		if (source === undefined) {
			return [];
		}
		return candidates(source).flatMap((node): readonly Finding[] => {
			if (!ts.isCallExpression(node)) {
				return [];
			}
			if (!changedBodies(checker, node).some((body) => transactionChanges(checker, body))) {
				return [];
			}
			return [
				{
					file: file.path,
					line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
					message:
						"Uses native sql.withTransaction around repository writes or change announcements. Begin the outer transaction with transact(effect, { onSqlError }) so changed keys follow its commit.",
				},
			];
		});
	});
}

export const nativeTransactionFindings = Effect.fn("NativeTransactions.nativeTransactionFindings")((inputs: RuleInputs) =>
	Effect.sync(() => {
		const groups = new Map<string, RuleInputs["sources"][number][]>();
		for (const source of inputs.sources) {
			const syntax = source.text.includes("withTransaction") ? parse(source) : undefined;
			if (syntax === undefined || candidates(syntax).length === 0) {
				continue;
			}
			const group = /^(?:packages|examples)\/[^/]+/u.exec(source.path)?.[0] ?? ".";
			const sources = groups.get(group) ?? [];
			sources.push(source);
			groups.set(group, sources);
		}
		return [...groups.values()].flatMap((sources) => findingsIn({ ...inputs, sources }));
	}),
);
