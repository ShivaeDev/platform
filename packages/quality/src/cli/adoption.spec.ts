import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adoption, baselinedFindings, jsxFixture, newRuleDebt } from "#test/adoption.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { conciseView, conditionalView, fragmentView, manualViews, mixedView, retainedView } from "#test/conditionalFixes.ts";

adoption.it(
	"recording a new rule's findings through the baseline script records them and makes the gate pass",
	[newRuleDebt],
	function* ({ gate, recordedDebt, recordsThroughBaselineScript }) {
		expect(yield* gate()).toBe("rejected");

		yield* recordsThroughBaselineScript("comments/no-todo");

		yield* outcomes({
			"gate": [gate(), "passed"],
			"recorded debt": [recordedDebt(), expect.stringContaining('"rule":"comments/no-todo","count":1')],
		});
	},
	CLI_TIMEOUT,
);

for (const [name, source] of [
	["block", conditionalView],
	["concise", conciseView],
	["fragment", fragmentView],
] as const) {
	adoption.it(
		`the JSX fix rewrites a ${name} return's conditional child, passes and preserves rendered values and read order`,
		[jsxFixture(source)],
		function* ({ fix, outcome, rendered, stdout }) {
			const before = yield* rendered(true);

			yield* fix("react/jsx-conditionals");

			yield* outcomes({
				"fix": [outcome(), "passed"],
				"rendered values and read order": [rendered(), before],
				"report": [stdout(), expect.stringContaining("rewrote 1 file")],
			});
		},
		CLI_TIMEOUT,
	);
}

adoption.it(
	"the JSX fix leaves attribute and mapped-child decisions unchanged and rejects them as manual findings",
	[jsxFixture(retainedView)],
	function* ({ fix, originalSource, outcome, source, stdout }) {
		const before = yield* originalSource();

		yield* fix("react/jsx-conditionals");

		yield* outcomes({
			"fix": [outcome(), "rejected"],
			"remaining findings": [stdout(), expect.stringContaining("Inside .map")],
			"source": [source(), before],
		});
	},
	CLI_TIMEOUT,
);

for (const rule of ["tests/grouped-outcomes", "imports/aliased"]) {
	adoption.it(
		`fixing ${rule} is refused as invalid because it has no safe mechanical fix, and the source stays unchanged`,
		[jsxFixture(retainedView)],
		function* ({ fix, originalSource, outcome, source, stderr }) {
			const before = yield* originalSource();

			yield* fix(rule);

			yield* outcomes({
				"error": [stderr(), expect.stringContaining(`No safe mechanical fix for ${rule}`)],
				"fix": [outcome(), "invalid"],
				"source": [source(), before],
			});
		},
		CLI_TIMEOUT,
	);
}

adoption.it(
	"the JSX fix moves a safe decision before the return, keeps the mapped decision and rejects it as a manual finding in the same file",
	[jsxFixture(mixedView)],
	function* ({ fix, outcome, source, stdout }) {
		yield* fix("react/jsx-conditionals");

		yield* outcomes({
			"fix": [outcome(), "rejected"],
			"mapped decision retained": [source(), expect.stringContaining("items.map(item => item.visible ? <i /> : null)")],
			"remaining finding": [stdout(), expect.stringContaining("Inside .map")],
			"safe decision moved before return": [source(), expect.stringContaining("const qualityContent1 =")],
		});
	},
	CLI_TIMEOUT,
);

adoption.it(
	"the JSX fix rejects manual findings even when the baseline already covers them",
	[jsxFixture(retainedView), baselinedFindings],
	function* ({ fix, gate, outcome, stdout }) {
		expect(yield* gate()).toBe("passed");

		yield* fix("react/jsx-conditionals");

		yield* outcomes({
			"fix": [outcome(), "rejected"],
			"report": [stdout(), expect.stringContaining("react/jsx-conditionals")],
		});
	},
	CLI_TIMEOUT,
);

for (const [name, fixture] of manualViews) {
	adoption.it(
		`the JSX fix leaves ${name} decisions unchanged and rejects them as manual findings`,
		[jsxFixture(fixture)],
		function* ({ fix, originalSource, outcome, source, stdout }) {
			const before = yield* originalSource();

			yield* fix("react/jsx-conditionals");

			yield* outcomes({
				"fix": [outcome(), "rejected"],
				"manual finding": [stdout(), expect.stringContaining("react/jsx-conditionals")],
				"source": [source(), before],
			});
		},
		CLI_TIMEOUT,
	);
}
