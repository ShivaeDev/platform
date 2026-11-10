import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { generatedOnce, generator, heavyLockHeldElsewhere, notesProject } from "#test/generator.ts";

const NOTES = "src/generated/modules/notes/notes.ts";

generator.it(
	"a generate that builds a program waits while another run holds the heavy lock, and writes the file once the lock is free",
	[notesProject(), heavyLockHeldElsewhere()],
	function* ({ generatedFile, heavyLockPollPasses, otherRunReleasesTheHeavyLock, startsGenerating, waitsForTheHeavyLock }) {
		yield* startsGenerating();
		yield* waitsForTheHeavyLock();
		expect(yield* generatedFile(NOTES)).toBe("missing");

		yield* otherRunReleasesTheHeavyLock();

		yield* outcomes([["generate", () => heavyLockPollPasses(), { files: { [NOTES]: "written" }, programBuilt: true, result: "succeeded" }]]);
	},
);

generator.it(
	"a generate with unchanged inputs finishes while another run holds the heavy lock",
	[notesProject(), generatedOnce(), heavyLockHeldElsewhere()],
	function* ({ generates }) {
		expect(yield* generates()).toMatchObject({ files: { [NOTES]: "unchanged" }, programBuilt: false });
	},
);
