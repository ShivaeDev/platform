import ts from "typescript";
import { defineRule, type Finding, type SourceFile } from "../../rule.ts";
import { parse } from "../syntax.ts";

const BRIDGES: ReadonlyMap<ts.SyntaxKind, string> = new Map([
	[ts.SyntaxKind.UnknownKeyword, "unknown"],
	[ts.SyntaxKind.AnyKeyword, "any"],
	[ts.SyntaxKind.NeverKeyword, "never"],
]);

type Assertion = ts.AsExpression | ts.TypeAssertion;

const isAssertion = (node: ts.Node): node is Assertion => ts.isAsExpression(node) || ts.isTypeAssertionExpression(node);

const unwrapped = (node: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(node) ? unwrapped(node.expression) : node);

const bridgeOf = (node: Assertion): string | undefined => {
	const inner = unwrapped(node.expression);
	return isAssertion(inner) ? BRIDGES.get(inner.type.kind) : undefined;
};

const castsIn = (path: string, source: ts.SourceFile): readonly Finding[] => {
	const findings: Finding[] = [];
	const visit = (node: ts.Node): void => {
		const bridge = isAssertion(node) ? bridgeOf(node) : undefined;
		if (bridge !== undefined) {
			const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
			findings.push({ file: path, line, message: `Casts through "${bridge}" to reach a type the value does not have.` });
		}
		ts.forEachChild(node, visit);
	};
	visit(source);
	return findings;
};

const doubleCasts = (file: SourceFile): readonly Finding[] => {
	const source = parse(file);
	return source === undefined ? [] : castsIn(file.path, source);
};

export const noDoubleCast = defineRule({
	check: ({ sources }) => sources.flatMap(doubleCasts),
	description:
		"A cast through unknown, any or never silences the compiler the way a suppression does. Decode the value at its boundary, narrow it, or fix the type that disagrees.",
	id: "suppressions/no-double-cast",
	registrable: false,
});
