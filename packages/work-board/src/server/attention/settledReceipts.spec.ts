import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { answeredReceiptDecision, attentionSources } from "#test/attentionLaneTraits.ts";
import { boardStory } from "#test/boardStory.ts";
import { changedAnswer, managedReceipt, managedReceiptsFixture, openAsk } from "#test/managedReceiptsFixture.ts";

const OTHER_REVISION = "a".repeat(64);
const ANSWERED_BY_ORCHESTRATOR = { author: "orchestrator", choice: "", response: "response.retry", yours: false };

boardStory.it(
	"an answered Fleet decision waits in Answered until Fleet records applied and superseded receipts, then leaves the inbox",
	[answeredReceiptDecision()],
	function* ({ inboxAnswers, inboxLane, recordsWritten }) {
		yield* outcomes([
			["answered", () => inboxAnswers(), [{ answered: ANSWERED_BY_ORCHESTRATOR, id: "task.context" }]],
			["needs you", () => inboxLane("you"), []],
		]);

		yield* recordsWritten({ ...managedReceipt("applied", "applied", 3000), ...managedReceipt("superseded", "superseded", 4000) });

		yield* outcomes([
			["answered", () => inboxAnswers(), []],
			["needs you", () => inboxLane("you"), []],
		]);
	},
);

boardStory.it(
	"receipts that disagree about the reviewed decision show a problem on the ask in Needs you",
	[
		answeredReceiptDecision(
			{ ...managedReceipt("applied", "applied", 3000), ...managedReceipt("stale", "superseded", 4000, OTHER_REVISION) },
			"Fleet recorded an applied receipt and a superseded receipt for another revision",
		),
	],
	function* ({ inboxProblems }) {
		expect(yield* inboxProblems()).toEqual([
			{
				href: "/_board/item/decision.context/#attention-request-context.1",
				id: "task.context",
				problem: "Request receipts disagree: responses/request-receipt.applied.md, responses/request-receipt.stale.md",
			},
		]);
	},
);

boardStory.it(
	"a receipt naming another revision shows a problem in Needs you instead of waiting for Fleet",
	[answeredReceiptDecision(managedReceipt("stale", "superseded", 4000, OTHER_REVISION), "Fleet recorded a superseded receipt for another revision")],
	function* ({ inboxAnswers, inboxProblems }) {
		yield* outcomes([
			["answered", () => inboxAnswers(), []],
			[
				"problems",
				() => inboxProblems(),
				[expect.objectContaining({ id: "task.context", problem: "Request receipts disagree: responses/request-receipt.stale.md" })],
			],
		]);
	},
);

boardStory.it(
	"a receipt for a replaced answer shows a problem in Needs you instead of waiting for Fleet",
	[
		answeredReceiptDecision(
			{ ...changedAnswer(), ...managedReceipt("applied", "applied", 3000) },
			"the answer was replaced after Fleet recorded applying it",
		),
	],
	function* ({ inboxAnswers, inboxProblems }) {
		yield* outcomes([
			["answered", () => inboxAnswers(), []],
			[
				"problems",
				() => inboxProblems(),
				[expect.objectContaining({ id: "task.context", problem: "Request receipts disagree: responses/request-receipt.applied.md" })],
			],
		]);
	},
);

boardStory.it(
	"an answered request between agents stays under agents without an answer, not in Answered",
	[attentionSources(managedReceiptsFixture(["orchestrator"]), "the orchestrator answered a Fleet decision addressed to the orchestrator")],
	function* ({ inboxAnswers, inboxLane }) {
		yield* outcomes([
			["agents", () => inboxLane("agents"), ["task.context"]],
			["answered", () => inboxAnswers(), []],
		]);
	},
);

boardStory.it(
	"an answered request between agents shows no answer on its decision",
	[attentionSources(managedReceiptsFixture(["orchestrator"]), "the orchestrator answered a Fleet decision addressed to the orchestrator")],
	function* ({ decisionRequests }) {
		expect(yield* decisionRequests("decision.context")).toEqual([["context.1", undefined]]);
	},
);

boardStory.it("an answered Fleet decision leaves its task's authored status ready", [answeredReceiptDecision()], function* ({ briefStatus }) {
	expect(yield* briefStatus("task.context")).toBe("ready");
});

boardStory.it(
	"an open ask about a task leaves its authored status ready while the ask stays open",
	[answeredReceiptDecision(openAsk(), "an open ask about task.context waits beside the answered Fleet decision")],
	function* ({ briefStatus, decisionRequests }) {
		yield* outcomes([
			["open asks", () => decisionRequests("decision.scope"), [["scope", undefined]]],
			["status", () => briefStatus("task.context"), "ready"],
		]);
	},
);
