import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { generatedLayout, generatorRefuses, generatorWrites, titleLimitExported } from "#test/generatedOutput.ts";
import { biomeFormatted, committed, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { assertThat, withMatchers } from "#testing/adapters/assertThat.ts";

const LAYOUT = [qualityInstalled(), repositoryHas(...generatedLayout), biomeFormatted()];

const GENERATED_NOTES = "src/generated/modules/notes/notes.ts";

repositoryStory.it(
	"quality lint runs the generate script first, so a checkout without generated files passes on the unformatted output git ignores",
	[...LAYOUT, generatorWrites("TitleTaken"), committed()],
	function* ({ outcome, reads, runs }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "passed"],
				["generated client", () => reads(GENERATED_NOTES), expect.stringContaining("export const Notes")],
			]),
		);
	},
);

repositoryStory.it(
	"quality lint counts an export that only generated output imports as used",
	[...LAYOUT, repositoryHas(titleLimitExported), generatorWrites("MAX_TITLE_LENGTH", "TitleTaken"), committed()],
	function* ({ outcome, runs }) {
		yield* runs("lint");

		yield* assertThat(yield* outcome(), (actual) => actual.toBe("passed"));
	},
);

repositoryStory.it(
	"quality lint stops with the generator's own message when the generate script refuses the code",
	[...LAYOUT, repositoryHas(generatorRefuses), committed()],
	function* ({ outcome, runs, stderr }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "invalid"],
				[
					"error output",
					() => stderr(),
					expect.stringContaining("notes.create: run returns Map<string, number> at success, which has no exact wire form"),
				],
			]),
		);
	},
);
