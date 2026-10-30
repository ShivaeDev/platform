import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { questionSource, settledFixture } from "#test/settledFixture.ts";

boardStory.it(
	"an archived question keeps its item link when a new open question reuses its source filename",
	[projectFiles(settledFixture().files), deferredServing],
	function* (board) {
		yield* board.archive();
		board.editFile("decisions/settled.md", questionSource("replacement", "ready", "open"));

		yield* board.start({ fleetPort: null });

		yield* outcomes({
			"archived item": [Effect.map(board.readItem("settled"), (item) => item.metadata.status), "done"],
			"new open item": [Effect.map(board.readItem("replacement"), (item) => item.metadata.status), "ready"],
		});
		expect((yield* board.readItem("settled")).requests?.flatMap((request) => request.responses ?? []).map((response) => response.id)).toEqual([
			"answer.settled",
		]);
	},
);
