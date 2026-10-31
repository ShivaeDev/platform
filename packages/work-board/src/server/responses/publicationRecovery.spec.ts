import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing } from "#test/boardStory.ts";
import { writerKilledAt } from "#test/publicationTraits.ts";

boardStory.it(
	"a writer killed after syncing its temporary file leaves that file and no record",
	[deferredServing, writerKilledAt("temporary")],
	function* ({ fileText, temporaryRecordTexts }) {
		yield* outcomes([
			["record", () => fileText("responses/response.interrupted.md"), "missing"],
			["temporary files", () => temporaryRecordTexts(), ["Retained feedback"]],
		]);
	},
);

boardStory.it(
	"a writer killed after publishing its record leaves the record and its temporary file",
	[deferredServing, writerKilledAt("published")],
	function* ({ fileText, temporaryRecordTexts }) {
		yield* outcomes([
			["record", () => fileText("responses/response.interrupted.md"), "Retained feedback"],
			["temporary files", () => temporaryRecordTexts(), ["Retained feedback"]],
		]);
	},
);

for (const phase of ["temporary", "published"] as const) {
	boardStory.it(
		`publishing again after a writer was killed at its ${phase} sync completes the record with the same text`,
		[deferredServing, writerKilledAt(phase)],
		function* ({ fileText, publishRecord }) {
			yield* outcomes([
				["publication", () => publishRecord("response.interrupted", "Retained feedback"), "published"],
				["record", () => fileText("responses/response.interrupted.md"), "Retained feedback"],
			]);
		},
	);
}
