import { expect } from "vitest";
import { boardStory } from "#test/boardStory.ts";
import { answerSavesWaitAtSourceRead, aTaskAwaitingDirection } from "#test/publicationTraits.ts";

const BODY = "Take the first direction.";

boardStory.it(
	"a Board shut down while an accepted answer save waits finishes saving it before it stops",
	[aTaskAwaitingDirection(), answerSavesWaitAtSourceRead()],
	function* ({ responseFilesOnDisk, shutDownBoard, startDirectionAnswer }) {
		yield* startDirectionAnswer("response.restart", BODY);
		expect(yield* responseFilesOnDisk()).toEqual([]);

		yield* shutDownBoard();

		expect(yield* responseFilesOnDisk()).toEqual(["response.restart.md"]);
	},
);

boardStory.it(
	"after a shutdown finished an answer, retrying it on the restarted Board returns the saved response and records it once",
	[aTaskAwaitingDirection(), answerSavesWaitAtSourceRead()],
	function* ({ answerDirection, directionHistory, shutDownBoard, start, startDirectionAnswer }) {
		yield* startDirectionAnswer("response.restart", BODY);
		yield* shutDownBoard();
		yield* start();
		const history = yield* directionHistory();
		expect(history).toMatchObject([{ body: BODY, id: "response.restart" }]);

		const retried = yield* answerDirection("response.restart", BODY);

		expect(retried).toEqual(history[0]);
		expect(yield* directionHistory()).toEqual(history);
	},
);
