import ts from "typescript";
import { type OutcomeAssertion, outcomeAssertions } from "#adapters/outcomeAssertions.ts";
import type { Finding, SourceFile } from "#rule.ts";
import type { storyOrigins } from "#rules/stories/origins.ts";
import { nodesWhere, unwrapped } from "#rules/stories/syntax.ts";

const MESSAGE =
	"Only rules out an outcome. Assert the expected refusal's domain reason or public response positively on the same outcome in this story; an unrelated failure must fail the story too.";

function concrete(node: ts.Expression): boolean {
	const value = unwrapped(node);
	return (
		(ts.isStringLiteralLike(value) && value.text.length > 0)
		|| (ts.isObjectLiteralExpression(value)
			&& value.properties.some((property) => ts.isPropertyAssignment(property) && concrete(property.initializer)))
	);
}

function sameExpected(left: ts.Expression, right: ts.Expression): boolean {
	const a = unwrapped(left);
	const b = unwrapped(right);
	return ts.isStringLiteralLike(a) && ts.isStringLiteralLike(b) ? a.text === b.text : a.getText() === b.getText();
}

function confirmsRefusal(positive: OutcomeAssertion, negative: OutcomeAssertion): boolean {
	return (
		!positive.negative && positive.subject === negative.subject && concrete(positive.expected) && !sameExpected(positive.expected, negative.expected)
	);
}

export function positiveRefusalFindings(file: SourceFile, origins: ReturnType<typeof storyOrigins>): readonly Finding[] {
	const source = origins.source(file.path);
	if (source === undefined) {
		return [];
	}
	return nodesWhere(source, (node) => ts.isCallExpression(node) && origins.origin(node.expression) === "story")
		.filter(ts.isCallExpression)
		.flatMap((story) => {
			const body = story.arguments[2];
			if (body === undefined) {
				return [];
			}
			const assertions = outcomeAssertions(body, origins.checker);
			return assertions
				.filter((negative) => negative.negative && !assertions.some((positive) => confirmsRefusal(positive, negative)))
				.map(({ node }) => ({
					file: file.path,
					line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
					message: MESSAGE,
				}));
		});
}
