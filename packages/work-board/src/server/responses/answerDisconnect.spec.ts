import { expect } from "vitest";
import { boardStory } from "#test/boardStory.ts";
import { answerSavesWaitAtSourceRead, aTaskAwaitingDirection } from "#test/publicationTraits.ts";
import { answerRequestsTraced } from "#test/questionRecordTraits.ts";

boardStory.it(
	"an answer whose browser leaves mid-save is still published once the save continues",
	[aTaskAwaitingDirection(), answerSavesWaitAtSourceRead(), answerRequestsTraced()],
	function* ({ browserLeaves, browserStartsAnswer, heldSaveContinues, responseFilesOnDisk }) {
		yield* browserStartsAnswer("response.leaving", "Take the first direction.");
		yield* browserLeaves();
		expect(yield* responseFilesOnDisk()).toEqual([]);

		yield* heldSaveContinues("response.leaving");

		expect(yield* responseFilesOnDisk()).toEqual(["response.leaving.md"]);
	},
);
