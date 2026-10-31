import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing } from "#test/boardStory.ts";
import { aTaskAwaitingDirection } from "#test/publicationTraits.ts";

const BODY = "Use PostgreSQL.";

for (const phase of ["temporary", "published"] as const) {
	boardStory.it(
		`after a Board process is killed writing the ${phase} file of an answer, retrying it on a new Board records it once`,
		[deferredServing, aTaskAwaitingDirection()],
		function* ({ answerDirection, boardKilledWhilePublishing, directionHistory, start }) {
			yield* boardKilledWhilePublishing(phase, BODY);
			yield* start();

			const saved = yield* answerDirection("response.restart", BODY);

			expect(saved).toMatchObject({ body: BODY, id: "response.restart" });
			yield* outcomes([
				["history", () => directionHistory(), [saved]],
				["second retry", () => answerDirection("response.restart", BODY), saved],
			]);
		},
	);

	boardStory.it(
		`the response feed shows an answer resumed after a Board process was killed writing its ${phase} file once, then the next answer`,
		[deferredServing, aTaskAwaitingDirection()],
		function* ({ answerDirection, boardKilledWhilePublishing, feedPrints, followAllResponses, start }) {
			yield* followAllResponses();
			yield* boardKilledWhilePublishing(phase, BODY);
			yield* start();
			yield* answerDirection("response.restart", BODY);
			expect(yield* feedPrints()).toBe("task.choice\tdirection\tresponse.restart\tUse PostgreSQL.");

			yield* answerDirection("response.next", "Keep the migration.");

			expect(yield* feedPrints()).toBe("task.choice\tdirection\tresponse.next\tKeep the migration.");
		},
	);
}
