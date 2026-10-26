import { Effect } from "effect";
import { expect } from "vitest";
import { InternalServerError } from "@shivaedev/contract/errors/taxonomy.ts";
import { boardFilesystem, boardStory, projectFiles } from "#test/boardStory.ts";
import { fleetReports } from "#test/storyTraits.ts";

boardStory.it(
	"redacts an index defect into a declared Fleet read rejection over HTTP",
	[
		projectFiles({ "note.md": "# Note" }),
		fleetReports({ completed: [], items: [] }),
		boardFilesystem((fs) => ({
			...fs,
			readFileString: () => Effect.die(new Error("Unexpected index defect")),
		})),
	],
	function* ({ rpc }) {
		const result = yield* rpc((client) => client("work-board.fleetItems", undefined)).pipe(Effect.result);
		expect(result).toMatchObject({ _tag: "Failure", failure: expect.any(InternalServerError) });
	},
);
