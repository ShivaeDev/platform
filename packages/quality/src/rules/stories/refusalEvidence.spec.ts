import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { positiveRefusals } from "#rules/stories/positiveRefusals.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat, withMatchers } from "#testing/adapters/assertThat.ts";
import { inStory, kitFiles } from "#testing/storySpecFiles.ts";

const SPEC = "src/orders.spec.ts";

for (const [form, line] of [
	["toBe", 'expect(yield* outcome()).not.toBe("accepted");'],
	["toEqual", "expect(yield* outcome()).not.toEqual({ accepted: true });"],
	["a named outcome readout", 'expect(yield* submitOutcome()).not.toBe("saved");'],
	["a public outcome field", 'expect((yield* response()).outcome).not.toBe("saved");'],
	["a stored readout", 'const answer = yield* outcome(); expect(answer).not.toBe("accepted");'],
	["soft assertions and literal member keys", 'expect.soft((yield* kit["outcome"]()))["not"]["toBe"]("accepted");'],
	["a renamed expect", 'verify(yield* outcome()).not.toEqual("accepted");'],
] as const) {
	ruleStory.it(
		`tests/positive-refusals reports a negative-only outcome using ${form} and asks for the expected refusal`,
		[repositoryHas({ content: `import { expect as verify } from "vitest";\n${inStory(line)}`, path: SPEC })],
		function* ({ check, locations, messages }) {
			yield* check(positiveRefusals);

			yield* withMatchers((expect) =>
				outcomes([
					["locations", () => locations(), [`${SPEC}:3`]],
					["repair", () => messages(), [expect.stringContaining("Assert the expected refusal's domain reason or public response positively")]],
				]),
			);
		},
	);
}

for (const [form, lines] of [
	["a domain reason", ['expect(yield* outcome()).toBe("unauthorized");']],
	["a public response", ['expect(yield* outcome()).toEqual({ reason: "forbidden" });']],
	["a partial response", ['expect(yield* outcome()).toMatchObject({ reason: "forbidden" });']],
	["a grouped outcome", ['yield* outcomes([["refusal", () => outcome(), "unauthorized"]]);']],
	["a renamed grouped outcome", ['yield* observations([["refusal", () => outcome(), { reason: "forbidden" }]]);']],
	["a stored readout alias", ['const answer = yield* outcome(); const refusal = answer; expect(refusal).toBe("forbidden");']],
] as const) {
	ruleStory.it(
		`tests/positive-refusals accepts a negative outcome check paired with ${form}`,
		[
			repositoryHas({
				content: `import { outcomes as observations } from "@shivaedev/test-story/server/outcomes.ts";\n${inStory('expect(yield* outcome()).not.toBe("accepted");', ...lines)}`,
				path: SPEC,
			}),
		],
		function* ({ check }) {
			yield* assertThat(yield* check(positiveRefusals), (actual) => actual.toEqual([]));
		},
	);
}

for (const [form, extra] of [
	["an unrelated value", 'expect(yield* title()).toBe("forbidden");'],
	["another outcome", 'expect(yield* otherOutcome()).toBe("forbidden");'],
	["another argument to the same readout", 'expect(yield* outcome("bob")).toBe("forbidden");'],
	["another negative check", 'expect(yield* outcome()).not.toEqual("saved");'],
	["an empty object", "expect(yield* outcome()).toEqual({});"],
	["a generic failure boolean", "expect(yield* outcome()).toBe(false);"],
	["a generic failure object", "expect(yield* outcome()).toMatchObject({ success: false });"],
	["a differently quoted success value", "expect(yield* outcome()).toBe('accepted');"],
	["the same success value", 'expect(yield* outcome()).toBe("accepted");'],
	["a callback that is never called", 'const unused = () => expect(outcome()).toBe("forbidden");'],
] as const) {
	ruleStory.it(
		`tests/positive-refusals keeps a negative outcome finding alongside ${form}`,
		[repositoryHas({ content: inStory('expect(yield* outcome()).not.toBe("accepted");', extra), path: SPEC })],
		function* ({ check, locations }) {
			yield* check(positiveRefusals);

			yield* assertThat(yield* locations(), (actual) =>
				actual.toEqual(form === "another negative check" ? [`${SPEC}:2`, `${SPEC}:3`] : [`${SPEC}:2`]),
			);
		},
	);
}

ruleStory.it(
	"tests/positive-refusals keeps each story's refusal evidence separate",
	[
		repositoryHas({
			content: [
				'import { storyKit } from "@shivaedev/test-story/server/storyKit.ts"; const orders = storyKit({});',
				'orders.it("is refused", [], function* () { expect(yield* outcome()).not.toBe("accepted"); });',
				'orders.it("names the refusal", [], function* () { expect(yield* outcome()).toBe("forbidden"); });',
			].join("\n"),
			path: SPEC,
		}),
	],
	function* ({ check, locations }) {
		yield* check(positiveRefusals);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual([`${SPEC}:2`]));
	},
);

ruleStory.it(
	"tests/positive-refusals follows a renamed story registrar through the local kit facade",
	[
		repositoryHas(...kitFiles, {
			content:
				'import { app } from "#test/index.ts"; const { it: scenario } = app; scenario("is refused", [], function* () { expect(yield* outcome()).not.toBe("accepted"); });',
			path: SPEC,
		}),
	],
	function* ({ check, locations }) {
		yield* check(positiveRefusals);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual([`${SPEC}:1`]));
	},
);

for (const line of [
	'expect(yield* backend()).not.toBe("previous backend");',
	"expect(yield* files()).not.toEqual([]);",
	'expect(yield* outcome()).toBe("forbidden");',
]) {
	ruleStory.it(
		`tests/positive-refusals accepts the independent assertion ${line}`,
		[repositoryHas({ content: inStory(line), path: SPEC })],
		function* ({ check }) {
			yield* assertThat(yield* check(positiveRefusals), (actual) => actual.toEqual([]));
		},
	);
}
