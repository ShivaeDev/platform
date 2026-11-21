import { nestedComponents } from "#rules/react/nestedComponents.ts";
import { FAILURE_HANDLERS, hooksRejected, METHOD_HANDLER, NESTED_HOOK, nestedAccepted, nestedRejected } from "#test/nestedComponentFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/assertThat.ts";

ruleStory.it(
	"react/nested-components accepts failure handlers keyed by an error tag in a component and a custom hook, as arrows and as a method",
	[repositoryHas(FAILURE_HANDLERS, METHOD_HANDLER)],
	function* ({ check, findings }) {
		yield* check(nestedComponents);

		yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
	},
);

for (const { code, message, name } of nestedRejected) {
	ruleStory.it(
		`react/nested-components reports ${name} with its repair`,
		[repositoryHas({ content: code, path: "src/view.tsx" })],
		function* ({ check, messages }) {
			yield* check(nestedComponents);

			yield* assertThat(yield* messages(), (actual) => actual.toEqual([message]));
		},
	);
}

for (const { code, name } of hooksRejected) {
	ruleStory.it(`react/nested-components reports ${name}`, [repositoryHas({ content: code, path: "src/rows.tsx" })], function* ({ check, messages }) {
		yield* check(nestedComponents);

		yield* assertThat(yield* messages(), (actual) => actual.toEqual([NESTED_HOOK]));
	});
}

for (const { code, name } of nestedAccepted) {
	ruleStory.it(`react/nested-components accepts ${name}`, [repositoryHas({ content: code, path: "src/view.tsx" })], function* ({ check, findings }) {
		yield* check(nestedComponents);

		yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
	});
}

ruleStory.it(
	"react/nested-components reports a nested component at the line of its name",
	[repositoryHas({ content: "export function Screen() {\n\tconst Row = () => <li />;\n\treturn <Row />;\n}\n", path: "src/view.jsx" })],
	function* ({ check, locations }) {
		yield* check(nestedComponents);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/view.jsx:2"]));
	},
);
