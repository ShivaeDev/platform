import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory } from "#test/boardStory.ts";
import { anOptionDecision, questionRegistered } from "#test/questionRecordTraits.ts";

const REGISTERED = [anOptionDecision(), questionRegistered("task.a", "question")];

boardStory.it(
	"the CLI waiting on a question past its 48-hour deadline exits with status 2 and prints nothing",
	REGISTERED,
	function* ({ cliWaits, outsideEditorExpiresQuestion }) {
		yield* outsideEditorExpiresQuestion();

		expect(yield* cliWaits()).toEqual({ exitCode: 2, printed: "nothing", told: expect.stringContaining("unanswered for 48 hours") });
	},
);

boardStory.it(
	"the CLI still delivers a reply recorded after the question's deadline",
	REGISTERED,
	function* ({ cliWaits, outsideEditorExpiresQuestion, recordReply }) {
		yield* outsideEditorExpiresQuestion();
		yield* recordReply({ body: "Not now; revisit next week.", id: "response.late", type: "not_now" });

		expect(yield* cliWaits()).toMatchObject({ exitCode: 0, printed: "response.late" });
	},
);

boardStory.it(
	"an agent that interrupts its wait leaves the question registered and unanswered",
	REGISTERED,
	function* ({ agentStartsWaiting, agentStopsWaiting, agentWaitOutcome, replyHistory }) {
		yield* agentStartsWaiting();

		yield* agentStopsWaiting();

		yield* outcomes([
			["agent's wait", () => agentWaitOutcome(), "interrupted"],
			["replies", () => replyHistory(), []],
		]);
	},
);
