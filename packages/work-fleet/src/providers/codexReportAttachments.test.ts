import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { REPORT_ATTACHMENT_DIRECTORY } from "#reportAttachments.ts";
import { attachmentStory } from "#test/attachmentStory.ts";
import { FUTURE_EXPIRY, syntheticToken } from "#test/codexCloud.ts";
import { addedAttachment } from "#test/reportAttachments.ts";
import { byCursor, page } from "#test/wireScript.ts";

const RECEIPT = { sessionId: "synthetic-session", turnId: "synthetic-turn" };
const OBSERVATION = { execution: "completed", output: "Report", provisioning: "unknown", receipt: RECEIPT } as const;
const HISTORY = [
	addedAttachment("evidence.txt", "old\n"),
	...Array.from({ length: 191 }, (_, index) => ({ id: `reasoning-${index}`, type: "reasoning" })),
	{
		changes: [
			{ diff: "@@ -1 +1 @@\n-old\n+final\n", kind: { "move_path": null, type: "update" }, path: `${REPORT_ATTACHMENT_DIRECTORY}evidence.txt` },
		],
		id: "update",
		type: "fileChange",
	},
].map((item) => ({ item }));

attachmentStory.it(
	"report attachments are rebuilt from the exact turn's file changes across item pages over an authenticated Cloud connection",
	[],
	function* ({ answers, download, offeredProtocols, sent }) {
		yield* answers({ "thread/items/list": byCursor({ "100": page(HISTORY.slice(100)), first: page(HISTORY.slice(0, 100), "100") }) });

		const downloaded = yield* download(OBSERVATION);

		expect(downloaded).toEqual({ files: [{ path: "evidence.txt", text: "final\n" }], unavailable: [] });
		function itemPage(cursor: string | null) {
			return { cursor, limit: 100, sortDirection: "asc", threadId: RECEIPT.sessionId, turnId: RECEIPT.turnId };
		}
		yield* outcomes([
			["offered protocols", () => offeredProtocols(), expect.arrayContaining([`openai-bearer.${syntheticToken("report", FUTURE_EXPIRY)}`])],
			["item pages", () => sent("thread/items/list"), [itemPage(null), itemPage("100")]],
		]);
	},
);

attachmentStory.it("a repeated item cursor fails instead of replaying the page forever", [], function* ({ answers, readItems }) {
	yield* answers({ "thread/items/list": page([], "repeated") });

	const outcome = yield* readItems(RECEIPT);

	expect(outcome).toMatch(/: Codex repeated an item pagination cursor$/u);
});

attachmentStory.it("downloaded bytes count across item pages towards the task size limit", [], function* ({ answers, readItems, sent }) {
	yield* answers({ "thread/items/list": byCursor({ first: page([], "next"), next: page([]) }) });

	const outcome = yield* readItems(RECEIPT, 50);

	expect(outcome).toContain("Downloaded report task size limit");
	expect(yield* sent("thread/items/list")).toEqual([expect.objectContaining({ cursor: null }), expect.objectContaining({ cursor: "next" })]);
});
