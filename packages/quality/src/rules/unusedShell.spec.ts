import { unusedCode } from "#rules/unusedCode.ts";
import { ruleStory } from "#test/ruleStory.ts";
import { codeFreeShell, shellWithCode } from "#test/unusedShell.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

ruleStory.it("code/unused accepts the dependencies of a package that ships only its manifest", codeFreeShell(), function* ({ check, findings }) {
	yield* check(unusedCode);

	yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
});

ruleStory.it("code/unused still reports a dependency no code imports once the package ships code", shellWithCode(), function* ({ check, findings }) {
	yield* check(unusedCode);

	yield* assertThat(
		(yield* findings()).map(({ file, subject }) => ({ file, subject })),
		(actual) => actual.toEqual([{ file: "packages/shell/package.json", subject: "dependencies:piece" }]),
	);
});
