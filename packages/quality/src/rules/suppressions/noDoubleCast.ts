import ts from "typescript";
import { defineRule, type Finding, type SourceFile } from "#rule.ts";
import { packageFindings } from "#rules/packageFindings.ts";
import { parse } from "#rules/parse.ts";
import { hiddenCast } from "#rules/suppressions/hiddenCast.ts";

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

export const noDoubleCast = defineRule({
	check: (inputs) => inputs.sources.flatMap(doubleCasts),
	deepHalf: { check: (inputs) => packageFindings(inputs, "suppressions/no-double-cast"), name: "typed half" },
	description:
		"Decode unknown values with Schema.decodeUnknownEffect and SQL rows with SqlSchema. Check declared overload returns and preserve Context service types and readonly native fields; writes on an object just built with new, before anything else can see it, are construction. Reports double casts everywhere and hidden casts outside adapters/ and test-support/.",
	id: "suppressions/no-double-cast",
	registrable: false,
});
