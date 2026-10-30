import { Effect } from "effect";
import ts from "typescript";
import { defineRule } from "#rule.ts";
import { importBindings } from "./importBindings.ts";
import { storySources } from "./sources.ts";
import { memberName, syntaxFindings, unwrapped } from "./syntax.ts";

const MESSAGE =
	'Checks several outcomes with consecutive expect(yield* …) lines. Let the story\'s words lead: yield* outcomes({ "label": [readout, expected], … }) from @shivaedev/test-story/server/outcomes.ts, one row per outcome. Keep a plain expect for a single outcome.';

const EXPECT_MODULES = ["vitest", "@effect/vitest"];

function yields(node: ts.Node): boolean {
	return (
		(ts.isYieldExpression(node) && node.asteriskToken !== undefined)
		|| (!ts.isFunctionLike(node) && ts.forEachChild(node, (child) => yields(child) || undefined) === true)
	);
}

function expectNames(source: ts.SourceFile): ReadonlySet<string> {
	const imported = [...importBindings(source)].filter(([, binding]) => binding.imported === "expect" && EXPECT_MODULES.includes(binding.module));
	return new Set(["expect", ...imported.map(([local]) => local)]);
}

function expectCall(node: ts.Expression, names: ReadonlySet<string>): ts.CallExpression | undefined {
	const value = unwrapped(node);
	if (ts.isCallExpression(value)) {
		const callee = unwrapped(value.expression);
		const receiver = ts.isPropertyAccessExpression(callee) && memberName(callee) === "soft" ? unwrapped(callee.expression) : callee;
		return ts.isIdentifier(receiver) && names.has(receiver.text) ? value : expectCall(value.expression, names);
	}
	return ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value) ? expectCall(value.expression, names) : undefined;
}

function statementsOf(node: ts.Node): readonly ts.Statement[] {
	return ts.isBlock(node) || ts.isSourceFile(node) || ts.isCaseClause(node) || ts.isDefaultClause(node) || ts.isModuleBlock(node)
		? node.statements
		: [];
}

function consecutiveChecks(source: ts.SourceFile): readonly ts.Node[] {
	const names = expectNames(source);
	function checksYield(statement: ts.Statement | undefined): boolean {
		const subject =
			statement !== undefined && ts.isExpressionStatement(statement) ? expectCall(statement.expression, names)?.arguments[0] : undefined;
		return subject !== undefined && yields(subject);
	}
	const runs: ts.Node[] = [];
	function visit(node: ts.Node): void {
		const statements = statementsOf(node);
		for (const [index, statement] of statements.entries()) {
			if (checksYield(statement) && checksYield(statements[index + 1]) && !checksYield(statements[index - 1])) {
				runs.push(statement);
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return runs;
}

export const groupedOutcomes = defineRule({
	check: (inputs) => Effect.map(storySources(inputs), (stories) => stories.flatMap((file) => syntaxFindings(file, consecutiveChecks, MESSAGE))),
	description: "Several outcomes after one action are rows of one outcomes call, so the story's words lead each line.",
	id: "tests/grouped-outcomes",
});
