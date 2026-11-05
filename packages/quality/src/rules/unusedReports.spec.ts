import { repositoryStory } from "#test/repositoryStory.ts";
import { unusedToolConfiguration } from "#test/unusedToolConfiguration.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const code of [0, 1, 2]) {
	repositoryStory.it(
		`quality rejects knip exiting ${code} without a report and preserves its stderr`,
		unusedToolConfiguration(`process.stderr.write("The test config stopped analysis.\\n"); process.exit(${code});`),
		function* ({ runs, stderr }) {
			const answer = yield* runs("lint");

			yield* assertThat(answer.outcome, (actual) => actual.toBe("invalid"));
			const error = yield* stderr();
			yield* assertThat(error, (actual) => actual.toContain(`knip exited ${code} without a valid report:`));
			yield* assertThat(error, (actual) => actual.toContain("The test config stopped analysis."));
		},
	);
}

repositoryStory.it(
	"quality rejects an unparsable knip report even when the process exits successfully",
	unusedToolConfiguration('process.stdout.write("not a JSON report"); process.exit(0);'),
	function* ({ runs, stderr }) {
		const answer = yield* runs("lint");

		yield* assertThat(answer.outcome, (actual) => actual.toBe("invalid"));
		yield* assertThat(yield* stderr(), (actual) => actual.toContain("knip exited 0 without a valid report:\nnot a JSON report"));
	},
);

repositoryStory.it(
	"quality rejects a successful knip exit when the report contains findings",
	unusedToolConfiguration('process.on("exit", () => { process.exitCode = 0; }); export default {};'),
	function* ({ runs, stderr }) {
		const answer = yield* runs("lint");

		yield* assertThat(answer.outcome, (actual) => actual.toBe("invalid"));
		yield* assertThat(yield* stderr(), (actual) => actual.toContain("knip exited 0 inconsistently with its report:"));
	},
);
