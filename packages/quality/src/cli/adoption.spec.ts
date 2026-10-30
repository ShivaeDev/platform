import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adoption, baselinedFindings, jsxFixture, newRuleDebt } from "#test/adoption.ts";
import { conciseView, conditionalView, fragmentView, manualViews, mixedView, retainedView } from "#test/conditionalFixes.ts";

adoption.it(
	"recording the new rule through the baseline script makes the gate pass",
	[newRuleDebt],
	function* ({ baseline, check, output, recordedDebt }) {
		yield* check();
		expect(yield* output()).toMatchObject({ status: 1, stdout: expect.stringContaining("comments/no-todo") });

		yield* baseline("comments/no-todo");

		expect(yield* recordedDebt()).toContain('"rule":"comments/no-todo","count":1');

		yield* check();

		expect(yield* output()).toMatchObject({ status: 0 });
	},
);

for (const [name, source] of [
	["block", conditionalView],
	["concise", conciseView],
	["fragment", fragmentView],
] as const) {
	adoption.it(
		`the JSX fix removes ${name} return findings and preserves rendered values and read order`,
		[jsxFixture(source)],
		function* ({ fix, output, rendered }) {
			const before = yield* rendered(true);

			yield* fix("react/jsx-conditionals");

			yield* outcomes({
				"fix command": [output(), expect.objectContaining({ status: 0, stdout: expect.stringContaining("rewrote 1 file") })],
				"rendered values and read order": [rendered(), before],
			});
		},
	);
}

adoption.it(
	"the JSX fix leaves attribute and mapped-child decisions unchanged and reported",
	[jsxFixture(retainedView)],
	function* ({ fix, originalSource, output, source }) {
		const before = yield* originalSource();

		yield* fix("react/jsx-conditionals");

		yield* outcomes({
			"remaining findings": [output(), expect.objectContaining({ status: 1, stdout: expect.stringContaining("Inside .map") })],
			"unmodified source": [source(), before],
		});
	},
);

for (const rule of ["tests/grouped-outcomes", "imports/aliased"]) {
	adoption.it(
		`${rule} says it has no safe mechanical fix and leaves source unchanged`,
		[jsxFixture(retainedView)],
		function* ({ fix, originalSource, output, source }) {
			const before = yield* originalSource();

			yield* fix(rule);

			yield* outcomes({
				"unmodified source": [source(), before],
				"unsupported fix": [output(), expect.objectContaining({ status: 2, stderr: expect.stringContaining(`No safe mechanical fix for ${rule}`) })],
			});
		},
	);
}

adoption.it(
	"the JSX fix repairs safe children while leaving manual findings reported in the same file",
	[jsxFixture(mixedView)],
	function* ({ fix, output, source }) {
		yield* fix("react/jsx-conditionals");

		yield* outcomes({
			"mapped decision retained": [source(), expect.stringContaining("items.map(item => item.visible ? <i /> : null)")],
			"remaining finding": [output(), expect.objectContaining({ status: 1, stdout: expect.stringContaining("Inside .map") })],
			"safe decision moved before return": [source(), expect.stringContaining("const qualityContent1 =")],
		});
	},
);

adoption.it(
	"the JSX fix reports manual findings even when the baseline already covers them",
	[jsxFixture(retainedView), baselinedFindings],
	function* ({ check, fix, output }) {
		yield* check();
		expect(yield* output()).toMatchObject({ status: 0 });

		yield* fix("react/jsx-conditionals");

		expect(yield* output()).toMatchObject({ status: 1, stdout: expect.stringContaining("react/jsx-conditionals") });
	},
);

for (const [name, fixture] of manualViews) {
	adoption.it(
		`the JSX fix leaves ${name} decisions unchanged and reported`,
		[jsxFixture(fixture)],
		function* ({ fix, originalSource, source, output }) {
			const before = yield* originalSource();

			yield* fix("react/jsx-conditionals");

			yield* outcomes({
				"manual finding": [output(), expect.objectContaining({ status: 1, stdout: expect.stringContaining("react/jsx-conditionals") })],
				"unmodified source": [source(), before],
			});
		},
	);
}
