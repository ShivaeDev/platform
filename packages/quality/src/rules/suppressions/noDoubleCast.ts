import { join } from "node:path";
import ts from "typescript";
import { defineRule, type Finding, type RuleInputs, type SourceFile } from "#rule.ts";
import { effectProgram } from "#rules/effect/program.ts";
import { parse } from "#rules/parse.ts";
import { hiddenCast, SQL_ROW_CAST } from "./hiddenCast.ts";
import { readonlyWrite, writeCandidate } from "./readonlyWrite.ts";

const BRIDGES: ReadonlyMap<ts.SyntaxKind, string> = new Map([
	[ts.SyntaxKind.UnknownKeyword, "unknown"],
	[ts.SyntaxKind.AnyKeyword, "any"],
	[ts.SyntaxKind.NeverKeyword, "never"],
]);

type Assertion = ts.AsExpression | ts.TypeAssertion;

function isAssertion(node: ts.Node): node is Assertion {
	return ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);
}

function unwrapped(node: ts.Expression): ts.Expression {
	return ts.isParenthesizedExpression(node) ? unwrapped(node.expression) : node;
}

function bridgeOf(node: Assertion): string | undefined {
	const inner = unwrapped(node.expression);
	return isAssertion(inner) ? BRIDGES.get(inner.type.kind) : undefined;
}

function castsIn(path: string, source: ts.SourceFile): readonly Finding[] {
	const findings: Finding[] = [];
	const hidden = !/(?:^|\/)(?:adapters|test-support)\//u.test(path);
	function visit(node: ts.Node): void {
		const bridge = isAssertion(node) ? bridgeOf(node) : undefined;
		const implicit = hidden ? hiddenCast(node) : undefined;
		const message = bridge === undefined ? implicit : `Casts through "${bridge}" to reach a type the value does not have.`;
		if (message !== undefined) {
			const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
			findings.push({ file: path, line, message });
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return findings;
}

function doubleCasts(file: SourceFile): readonly Finding[] {
	const source = parse(file);
	return source === undefined ? [] : castsIn(file.path, source);
}

function typedNodes(source: ts.SourceFile): readonly ts.Node[] {
	const nodes: ts.Node[] = [];
	function visit(node: ts.Node): void {
		if (writeCandidate(node) || (ts.isTaggedTemplateExpression(node) && node.typeArguments?.length && node.tag.getText() !== "sql")) {
			nodes.push(node);
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return nodes;
}

function typedCast(node: ts.Node, checker: ts.TypeChecker): string | undefined {
	if (ts.isTaggedTemplateExpression(node)) {
		const nativeSql = checker
			.getTypeAtLocation(node.tag)
			.getSymbol()
			?.getDeclarations()
			?.some((declaration) =>
				/(?:^|\/)effect\/(?:src|dist(?:\/[^/]+)?)\/sql\/(?:SqlClient|Statement)\.(?:d\.)?ts$/u.test(declaration.getSourceFile().fileName),
			);
		return nativeSql ? SQL_ROW_CAST : undefined;
	}
	return readonlyWrite(node, checker);
}

function typedCasts(inputs: RuleInputs): readonly Finding[] {
	const sources = inputs.sources.filter((file) => {
		const source = parse(file);
		return !/(?:^|\/)(?:adapters|test-support)\//u.test(file.path) && source !== undefined && typedNodes(source).length > 0;
	});
	if (sources.length === 0) {
		return [];
	}
	const program = effectProgram({ ...inputs, sources });
	const checker = program.getTypeChecker();
	return sources.flatMap((file) => {
		const source = program.getSourceFile(join(inputs.root, file.path));
		return source === undefined
			? []
			: typedNodes(source).flatMap((node) => {
					const message = typedCast(node, checker);
					return message === undefined
						? []
						: [{ file: file.path, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, message }];
				});
	});
}

export const noDoubleCast = defineRule({
	check: (inputs) => [...inputs.sources.flatMap(doubleCasts), ...typedCasts(inputs)],
	description:
		"Decode unknown values with Schema.decodeUnknownEffect and SQL rows with SqlSchema. Check declared overload returns and preserve Context service types and readonly native fields. Reports double casts everywhere and hidden casts outside adapters/ and test-support/.",
	id: "suppressions/no-double-cast",
	registrable: false,
});
