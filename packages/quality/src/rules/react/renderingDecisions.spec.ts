import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { jsxConditionals } from "#rules/react/jsxConditionals.ts";
import { jsxAccepted, jsxDecision, jsxDecisions, jsxJavascript } from "#test/jsxConditionalFiles.ts";

ruleKit.it(
	"authors get a repair for every JSX child decision, including nested and mapped items",
	[repositoryHas(jsxDecisions), repositoryHas(jsxJavascript)],
	function* ({ checks }) {
		const findings = yield* checks(jsxConditionals);
		expect(findings.map(({ file, line }) => [file, line])).toEqual([
			["src/decisions.tsx", 1],
			["src/decisions.tsx", 2],
			["src/decisions.tsx", 3],
			["src/decisions.tsx", 4],
			["src/decisions.tsx", 4],
			["src/decisions.tsx", 5],
			["src/decisions.tsx", 5],
			["src/decisions.tsx", 6],
			["src/decisions.tsx", 7],
			["src/decisions.tsx", 8],
			["src/decisions.tsx", 9],
			["src/view.jsx", 1],
		]);
		for (const finding of findings) {
			expect(finding.message).toContain("if and early return");
			expect(finding.message).toContain("variable computed above the return");
			expect(finding.message).toContain("component that receives the data and returns null");
		}
		for (const finding of findings.filter(({ line }) => line === 6 || line === 8 || line === 9)) {
			expect(finding.message).toContain("Inside .map, extract the item into its own component");
		}
	},
);

ruleKit.it("components decide before their JSX and keep conditional attribute values", [repositoryHas(jsxAccepted)], function* ({ checks, writes }) {
	expect(yield* checks(jsxConditionals)).toEqual([]);
	yield* writes(jsxDecision);
	expect(yield* checks(jsxConditionals)).toEqual([{ file: "src/accepted.tsx", line: 1, message: expect.stringContaining("Decide before the JSX") }]);
});
