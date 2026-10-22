import { expect } from "vitest";
import { inboxCount } from "#server/navigation/model.ts";
import { questionId, questionMarkdown, revisionOf } from "#server/responses/records.ts";
import { boardStory, deferredServing } from "#test/boardStory.ts";
import { closedInboxFixture } from "#test/closedInboxFixture.ts";
import { anInbox } from "#test/storyTraits.ts";
import { inboxItems } from "./inbox.ts";
import { requestInbox } from "./requestInbox.ts";

boardStory.it(
	"keeps only the latest ask for open work and the authored question in the Inbox",
	[deferredServing, anInbox()],
	function* ({ readAttention }) {
		const snapshot = yield* readAttention(closedInboxFixture());
		const rows = inboxItems(snapshot);
		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.id)).toEqual(["question.storage", "task.draft"]);
		expect(rows[1]?.reason).toBe("Fleet asks: draft ask 2");
		expect(rows[1]?.earlierAsks).toBe(1);
		expect(rows[1]?.href).toBe("/_board/item/decision.draft.2/#answer-card-approval");
		expect(inboxCount(snapshot)).toBe(2);
		const groups = requestInbox(snapshot);
		expect(groups.resolved).toHaveLength(4);
		expect(groups.parked).toHaveLength(1);
	},
);

for (const status of ["done", "dropped"]) {
	boardStory.it(
		`resolves managed asks when all targets are ${status}, including criterion references`,
		[deferredServing, anInbox()],
		function* ({ readAttention }) {
			const files = closedInboxFixture();
			files["done.md"] = `---\nid: task.done\nstatus: ${status}\ncriteria:\n  - id: proof\n    text: Evidence\n---\n# Finished work\n`;
			files["asks/done-1.md"] = files["asks/done-1.md"]?.replace("[task.done]", "[task.done#proof, task.dropped]") ?? "";
			expect(requestInbox(yield* readAttention(files)).resolved).toHaveLength(4);
		},
	);
}

boardStory.it(
	"keeps mixed closed and deferred targets visible and parks only wholly deferred work",
	[deferredServing, anInbox()],
	function* ({ readAttention }) {
		const files = closedInboxFixture();
		files["asks/done-1.md"] = files["asks/done-1.md"]?.replace("[task.done]", "[task.done, task.deferred]") ?? "";
		files["asks/deferred-1.md"] = files["asks/deferred-1.md"]?.replace("[task.deferred]", "[task.deferred, task.done]") ?? "";
		const groups = requestInbox(yield* readAttention(files));
		expect(groups.resolved).toHaveLength(3);
		expect(groups.parked).toHaveLength(0);
		expect(groups.items).toHaveLength(2);
		expect(groups.items.find((item) => item.id === "decision.deferred.1")?.earlierAsks).toBe(1);
	},
);

boardStory.it(
	"uses source modification time to select the newest ask regardless of file order",
	[deferredServing, anInbox()],
	function* ({ readAttention }) {
		const snapshot = yield* readAttention(closedInboxFixture());
		const modified = new Map([...snapshot.modified, ["asks/draft-1.md", 100_000] as const]);
		const item = inboxItems({ ...snapshot, modified }).find((row) => row.id === "task.draft");
		expect(item?.reason).toBe("Fleet asks: draft ask 1");
		expect(item?.earlierAsks).toBe(1);
	},
);

boardStory.it(
	"counts separate requests in one source and groups criterion references by item",
	[deferredServing, anInbox()],
	function* ({ readAttention }) {
		const files = closedInboxFixture();
		delete files["asks/draft-2.md"];
		files["draft.md"] = files["draft.md"]?.replace("owner: codex", "owner: codex\ncriteria:\n  - id: proof\n    text: Evidence") ?? "";
		files["asks/draft-1.md"] =
			files["asks/draft-1.md"]?.replace(
				"    unblocks: [task.draft]",
				"    unblocks: [task.draft#proof]\n  - id: later\n    kind: decision\n    managed: true\n    state: open\n    reason: Later request in the same source\n    response_from: [maintainer]\n    unblocks: [task.draft]",
			) ?? "";
		const items = inboxItems(yield* readAttention(files));
		expect(items).toHaveLength(2);
		expect(items[1]?.reason).toBe("Fleet asks: Later request in the same source");
		expect(items[1]?.earlierAsks).toBe(1);
		expect(items[1]?.href).toBe("/_board/item/decision.draft.1/#answer-card-later");
	},
);

boardStory.it(
	"groups registered asks on ordinary attention sources with other asks for the same item",
	[deferredServing, anInbox()],
	function* ({ readAttention }) {
		const files = closedInboxFixture();
		const source = files["asks/draft-2.md"]?.replace("managed: true", "managed: false") ?? "";
		files["asks/draft-2.md"] = source;
		const reviewedRevision = revisionOf(source);
		files["responses/draft.md"] = questionMarkdown({
			context: source,
			id: questionId("decision.draft.2", "approval", reviewedRevision, "asks/draft-2.md"),
			question: {
				deadline: 200,
				item: "decision.draft.2",
				reason: "draft ask 2",
				registeredAt: 100,
				request: "approval",
				reviewedRevision,
				source: "asks/draft-2.md",
			},
		});
		const items = inboxItems(yield* readAttention(files));
		expect(items).toHaveLength(2);
		expect(items[1]?.id).toBe("task.draft");
		expect(items[1]?.reason).toBe("draft ask 2");
		expect(items[1]?.earlierAsks).toBe(1);
	},
);
