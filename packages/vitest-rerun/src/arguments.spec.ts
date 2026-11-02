import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { argumentStory } from "#test/argumentStory.ts";
import { rerunStory } from "#test/kit.ts";

argumentStory.it("an invalid Vitest argument fails the attempt with a typed error naming the argument", [], function* ({ attempt }) {
	expect(yield* attempt("--silent=invalid")).toContain('VitestRerunError: Could not parse Vitest arguments: Unexpected value "--silent=invalid"');
});

rerunStory.it(
	"an invalid Vitest argument prints a diagnostic naming the argument and fails the command",
	[],
	function* ({ runExecutable, printedError, exitCode }) {
		yield* runExecutable("--silent=invalid");

		yield* outcomes([
			["exit code", () => exitCode(), 1],
			["diagnostic", () => printedError(), expect.stringContaining('Could not parse Vitest arguments: Unexpected value "--silent=invalid"')],
		]);
	},
);
