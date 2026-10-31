import { expect } from "vitest";
import { jsxConditionals } from "#rules/react/jsxConditionals.ts";
import { CHILD_DECISION, jsxAccepted, jsxDecisions } from "#test/jsxConditionalFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const { code, findings, name } of jsxDecisions) {
	ruleStory.it(
		`react/jsx-conditionals reports ${name} with its repair`,
		[repositoryHas({ content: code, path: "src/view.tsx" })],
		function* ({ check, messages }) {
			yield* check(jsxConditionals);

			expect(yield* messages()).toEqual(findings);
		},
	);
}

for (const { code, name } of jsxAccepted) {
	ruleStory.it(`react/jsx-conditionals accepts ${name}`, [repositoryHas({ content: code, path: "src/view.tsx" })], function* ({ check, findings }) {
		yield* check(jsxConditionals);

		expect(yield* findings()).toEqual([]);
	});
}

ruleStory.it(
	"react/jsx-conditionals reports a JSX child decision in a .jsx file at its line",
	[repositoryHas({ content: "const View = () => <div>{ready && <X />}</div>;", path: "src/view.jsx" })],
	function* ({ check, findings }) {
		yield* check(jsxConditionals);

		expect(yield* findings()).toEqual([{ file: "src/view.jsx", line: 1, message: CHILD_DECISION }]);
	},
);
