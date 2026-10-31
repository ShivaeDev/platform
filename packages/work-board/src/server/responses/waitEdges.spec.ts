import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory } from "#test/boardStory.ts";
import { localServiceAnswers } from "#test/questionRecordTraits.ts";

const OUTAGES = localServiceAnswers(["unavailable", "unavailable", "waiting", "replies"]);

boardStory.it(
	"an agent whose local service is unavailable asks again two seconds later",
	[OUTAGES],
	function* ({ agentClockAdvances, agentWaitStarts, serviceRequestTimes }) {
		yield* agentWaitStarts();
		yield* agentClockAdvances("1999 millis");
		expect(yield* serviceRequestTimes()).toEqual([0]);

		yield* agentClockAdvances("1 millis");

		expect(yield* serviceRequestTimes()).toEqual([0, 2000]);
	},
);

boardStory.it(
	"an agent rides out repeated outages, reporting the outage once, until the reply arrives",
	[OUTAGES],
	function* ({ agentClockAdvances, agentMessages, agentWaitOutcome, agentWaitStarts, serviceRequestTimes }) {
		yield* agentWaitStarts();

		yield* agentClockAdvances("2 seconds");
		yield* agentClockAdvances("2 seconds");

		yield* outcomes([
			["agent's wait", () => agentWaitOutcome(), "response.edge"],
			["messages", () => agentMessages(), ["Local service unavailable; reconnecting to the same question."]],
			["request times", () => serviceRequestTimes(), [0, 2000, 4000, 4000]],
		]);
	},
);

boardStory.it(
	"an agent that loses its local service after the question's deadline does not claim the question went unanswered",
	[localServiceAnswers(["waiting past its deadline", "unavailable"])],
	function* ({ agentWaitOutcome, agentWaitStarts, serviceRequestTimes }) {
		yield* agentWaitStarts();

		yield* outcomes([
			[
				"agent's wait",
				() => agentWaitOutcome(),
				"unavailable: The service is unavailable at the deadline; unanswered status could not be verified. Re-read this question when it returns.",
			],
			["request times", () => serviceRequestTimes(), [0, 0]],
		]);
	},
);
