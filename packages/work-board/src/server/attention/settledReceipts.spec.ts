import { expect } from "vitest";
import { boardStory } from "#test/boardStory.ts";
import { changedAnswer, managedReceipt, managedReceiptsFixture, openAsk } from "#test/managedReceiptsFixture.ts";
import { anInbox } from "#test/storyTraits.ts";

const other = "a".repeat(64);

boardStory.it(
	"settles an answered decision once Fleet records applied and superseded receipts",
	[anInbox()],
	function* ({ readAttention, readInbox }) {
		const waiting = yield* readInbox(yield* readAttention(managedReceiptsFixture()));
		expect(waiting.you).toEqual([]);
		expect(waiting.answered.map((item) => [item.id, item.answered, item.problem])).toEqual([
			["task.context", { author: "orchestrator", choice: "", response: "response.retry", yours: false }, undefined],
		]);
		const settled = yield* readInbox(
			yield* readAttention({
				...managedReceiptsFixture(),
				...managedReceipt("applied", "applied", 3000),
				...managedReceipt("superseded", "superseded", 4000),
			}),
		);
		expect(settled.you).toEqual([]);
		expect(settled.answered).toEqual([]);
	},
);

boardStory.it("shows receipts that disagree about the reviewed decision as a problem", [anInbox()], function* ({ readAttention, readInbox }) {
	const inbox = yield* readInbox(
		yield* readAttention({
			...managedReceiptsFixture(),
			...managedReceipt("applied", "applied", 3000),
			...managedReceipt("stale", "superseded", 4000, other),
		}),
	);
	expect(inbox.you.map((item) => [item.id, item.href, item.problem])).toEqual([
		[
			"task.context",
			"/_board/item/decision.context/#attention-request-context.1",
			"Request receipts disagree: responses/request-receipt.applied.md, responses/request-receipt.stale.md",
		],
	]);
});

boardStory.it(
	"shows a receipt that names another revision as a problem instead of waiting for Fleet",
	[anInbox()],
	function* ({ readAttention, readInbox }) {
		const inbox = yield* readInbox(yield* readAttention({ ...managedReceiptsFixture(), ...managedReceipt("stale", "superseded", 4000, other) }));
		expect(inbox.answered).toEqual([]);
		expect(inbox.you.map((item) => [item.id, item.problem])).toEqual([
			["task.context", "Request receipts disagree: responses/request-receipt.stale.md"],
		]);
	},
);

boardStory.it(
	"shows a receipt for a replaced answer as a problem instead of waiting for Fleet",
	[anInbox()],
	function* ({ readAttention, readInbox }) {
		const inbox = yield* readInbox(
			yield* readAttention({ ...managedReceiptsFixture(), ...changedAnswer(), ...managedReceipt("applied", "applied", 3000) }),
		);
		expect(inbox.answered).toEqual([]);
		expect(inbox.you.map((item) => [item.id, item.problem])).toEqual([
			["task.context", "Request receipts disagree: responses/request-receipt.applied.md"],
		]);
	},
);

boardStory.it(
	"keeps an answered request between agents out of the Answered lane and its answer card",
	[anInbox()],
	function* ({ readAttention, readInbox, readMcpItem }) {
		const inbox = yield* readInbox(yield* readAttention(managedReceiptsFixture(["orchestrator"])));
		expect(inbox.answered).toEqual([]);
		expect(inbox.agents.map((item) => [item.id, item.answered])).toEqual([["task.context", undefined]]);
		const decision = yield* readMcpItem(managedReceiptsFixture(["orchestrator"]), "decision.context");
		expect(decision.openDecisions.map((request) => [request.id, request.answered])).toEqual([["context.1", undefined]]);
	},
);

boardStory.it("tells agents an answered item waits for Fleet unless another ask still needs you", [anInbox()], function* ({ readMcpItem }) {
	expect((yield* readMcpItem(managedReceiptsFixture(), "task.context")).status).toBe("waiting-on-agents");
	const asked = yield* readMcpItem({ ...managedReceiptsFixture(), ...openAsk() }, "task.context");
	expect(asked.status).toBe("needs-you");
});
