import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { groupedOutcomes } from "#rules/stories/groupedOutcomes.ts";
import { inStory } from "#test/storySpecFiles.ts";

const SPEC = "src/orders.spec.ts";

ruleKit.it(
	"each run of consecutive expect(yield* …) checks is reported once, at its first check",
	[
		repositoryHas({
			content: [
				'orders.it("cancelling refunds the order", [], function* ({ cancel, order, refunds, stock }) {',
				"\tyield* cancel();",
				'\texpect(yield* order()).toBe("cancelled");',
				'\texpect.soft(yield* refunds()).toEqual(["order 1"]);',
				'\texpect((yield* stock()).reserved).not.toContain("order 1");',
				"\tfor (const shelf of shelves) {",
				'\t\texpect(yield* stock(shelf)).toBe("free");',
				"",
				'\t\texpect(yield* order()).toBe("cancelled");',
				"\t}",
				"});",
			].join("\n"),
			path: SPEC,
		}),
	],
	function* ({ checks }) {
		const findings = yield* checks(groupedOutcomes);

		expect(findings).toEqual([3, 7].map((line) => ({ file: SPEC, line, message: expect.stringContaining("yield* outcomes({") })));
	},
);

ruleKit.it(
	"rewriting a run of checks as one outcomes call clears its finding",
	[
		repositoryHas({
			content: inStory("yield* cancel();", 'expect(yield* order()).toBe("cancelled");', 'expect(yield* refunds()).toEqual(["order 1"]);'),
			path: SPEC,
		}),
	],
	function* ({ checks, writes }) {
		expect(yield* checks(groupedOutcomes)).toEqual([expect.objectContaining({ file: SPEC, line: 3 })]);

		yield* writes({
			content: inStory("yield* cancel();", 'yield* outcomes({ order: [order(), "cancelled"], refunds: [refunds(), ["order 1"]] });'),
			path: SPEC,
		});

		expect(yield* checks(groupedOutcomes)).toEqual([]);
	},
);

ruleKit.it(
	"one check after each action and plain expects of a read value pass",
	[
		repositoryHas({
			content: inStory(
				'expect(yield* order()).toBe("open");',
				"yield* cancel();",
				'expect(yield* order()).toBe("cancelled");',
				"const refunded = yield* refunds();",
				'expect(refunded).toEqual(["order 1"]);',
				"expect(refunded).toHaveLength(1);",
			),
			path: SPEC,
		}),
	],
	function* ({ checks }) {
		expect(yield* checks(groupedOutcomes)).toEqual([]);
	},
);
