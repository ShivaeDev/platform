import { repositoryStory } from "#test/repositoryStory.ts";
import { unusedToolConfiguration } from "#test/unusedToolConfiguration.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const code of [0, 1, 2]) {
	repositoryStory.it(
		`quality reports knip exiting ${code} without a report and preserves its stderr`,
		unusedToolConfiguration(`process.stderr.write("The test config stopped analysis.\\n"); process.exit(${code});`),
		function* ({ runs, stdout }) {
			const answer = yield* runs("lint");

			yield* assertThat(answer.outcome, (actual) => actual.toBe("rejected"));
			const error = yield* stdout();
			yield* assertThat(error, (actual) => actual.toContain(`knip exited ${code} without a valid report:`));
			yield* assertThat(error, (actual) => actual.toContain("The test config stopped analysis."));
		},
	);
}

repositoryStory.it(
	"quality reports an unparsable knip report even when the process exits successfully",
	unusedToolConfiguration('process.stdout.write("not a JSON report"); process.exit(0);'),
	function* ({ runs, stdout }) {
		const answer = yield* runs("lint");

		yield* assertThat(answer.outcome, (actual) => actual.toBe("rejected"));
		yield* assertThat(yield* stdout(), (actual) => actual.toContain("knip exited 0 without a valid report:\nnot a JSON report"));
	},
);

repositoryStory.it(
	"quality reports a successful knip exit when the report contains findings",
	unusedToolConfiguration('process.on("exit", () => { process.exitCode = 0; }); export default {};'),
	function* ({ runs, stdout }) {
		const answer = yield* runs("lint");

		yield* assertThat(answer.outcome, (actual) => actual.toBe("rejected"));
		yield* assertThat(yield* stdout(), (actual) => actual.toContain("knip exited 0 inconsistently with its report:"));
	},
);
