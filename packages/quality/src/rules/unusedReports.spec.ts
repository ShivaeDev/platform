import { expect } from "vitest";
import { repositoryStory } from "#test/repositoryStory.ts";
import { unusedToolConfiguration } from "#test/unusedToolConfiguration.ts";

for (const code of [0, 1, 2]) {
	repositoryStory.it(
		`quality rejects knip exiting ${code} without a report and preserves its stderr`,
		unusedToolConfiguration(`process.stderr.write("The test config stopped analysis.\\n"); process.exit(${code});`),
		function* ({ runs, stderr }) {
			const answer = yield* runs("lint");

			expect(answer.outcome).toBe("invalid");
			const error = yield* stderr();
			expect(error).toContain(`knip exited ${code} without a valid report:`);
			expect(error).toContain("The test config stopped analysis.");
		},
	);
}

repositoryStory.it(
	"quality rejects an unparsable knip report even when the process exits successfully",
	unusedToolConfiguration('process.stdout.write("not a JSON report"); process.exit(0);'),
	function* ({ runs, stderr }) {
		const answer = yield* runs("lint");

		expect(answer.outcome).toBe("invalid");
		expect(yield* stderr()).toContain("knip exited 0 without a valid report:\nnot a JSON report");
	},
);

repositoryStory.it(
	"quality rejects a successful knip exit when the report contains findings",
	unusedToolConfiguration('process.on("exit", () => { process.exitCode = 0; }); export default {};'),
	function* ({ runs, stderr }) {
		const answer = yield* runs("lint");

		expect(answer.outcome).toBe("invalid");
		expect(yield* stderr()).toContain("knip exited 0 inconsistently with its report:");
	},
);
