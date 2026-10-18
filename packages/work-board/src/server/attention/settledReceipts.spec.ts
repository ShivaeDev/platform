import { expect } from "vitest";
import { boardStory } from "#test/boardStory.ts";
import { managedReceipt, managedReceiptsFixture } from "#test/managedReceiptsFixture.ts";
import { anInbox } from "#test/storyTraits.ts";

const other = "a".repeat(64);

boardStory.it(
	"settles an answered decision once Fleet records applied and superseded receipts",
	[anInbox()],
	function* ({ readAttention, readInbox }) {
		const waiting = yield* readInbox(yield* readAttention(managedReceiptsFixture()));
		expect(waiting.you.map((item) => [item.id, item.reason, item.problem])).toEqual([
			["task.context", "Managed decision: Board context changed", undefined],
		]);
		const settled = yield* readInbox(
			yield* readAttention({
				...managedReceiptsFixture(),
				...managedReceipt("applied", "applied", 3000),
				...managedReceipt("superseded", "superseded", 4000),
			}),
		);
		expect(settled.you).toEqual([]);
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

boardStory.it("keeps a decision waiting when its only receipt names another revision", [anInbox()], function* ({ readAttention, readInbox }) {
	const inbox = yield* readInbox(yield* readAttention({ ...managedReceiptsFixture(), ...managedReceipt("stale", "superseded", 4000, other) }));
	expect(inbox.you.map((item) => [item.id, item.problem])).toEqual([["task.context", undefined]]);
});
