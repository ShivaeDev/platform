import { echo, maxFiles, todo } from "#test/definedRules.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const THREE_FILES = [
	{ content: "export const a = 1;\n", path: "src/a.ts" },
	{ content: "export const b = 1;\n", path: "src/b.ts" },
	{ content: "export const c = 1;\n", path: "src/c.ts" },
];

ruleStory.it(
	"a rule made with defineRule reports its findings in the files it reads",
	[repositoryHas({ content: "ok\n// TODO: later\n", path: "src/a.ts" })],
	function* ({ check }) {
		const findings = yield* check(todo);

		yield* assertThat(findings, (actual) => actual.toEqual([{ file: "src/a.ts", line: 2, message: "Resolve this TODO." }]));
	},
);

ruleStory.it("a rule that declares no options refuses any options", [], function* ({ optionIssues }) {
	const issues = yield* optionIssues(todo, { strict: true });

	yield* assertThat(issues, (actual) => actual.toEqual(["this rule takes no options"]));
});

ruleStory.it("a rule whose options are left out applies its schema's defaults", [repositoryHas(...THREE_FILES)], function* ({ check }) {
	const findings = yield* check(maxFiles);

	yield* assertThat(findings, (actual) => actual.toEqual([{ file: ".", message: "3 files exceed 2." }]));
});

ruleStory.it("an asynchronous check receives the options it was given", [repositoryHas(...THREE_FILES)], function* ({ check }) {
	const findings = yield* check(maxFiles, { max: 5 });

	yield* assertThat(findings, (actual) => actual.toEqual([]));
});

ruleStory.it("a rule names the option path of each issue its schema raises", [], function* ({ optionIssues }) {
	const issues = yield* optionIssues(echo, {});

	yield* assertThat(issues, (actual) => actual.toEqual(["word: needs a word"]));
});

ruleStory.it("a rule's check receives the value its Standard Schema decoded", [], function* ({ check }) {
	const findings = yield* check(echo, { word: "quiet" });

	yield* assertThat(findings, (actual) => actual.toEqual([{ file: "echo", message: "QUIET" }]));
});
