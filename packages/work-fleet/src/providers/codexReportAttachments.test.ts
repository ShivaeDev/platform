import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { REPORT_ATTACHMENT_DIRECTORY } from "#reportAttachments.ts";
import { attachmentStory } from "#test/attachmentStory.ts";
import { requestCursor } from "#test/codex.ts";
import { FUTURE_EXPIRY, syntheticToken } from "#test/codexCloud.ts";
import { addedAttachment } from "#test/reportAttachments.ts";

const observation = {
	execution: "completed",
	output: "Report",
	provisioning: "unknown",
	receipt: { sessionId: "synthetic-session", turnId: "synthetic-turn" },
} as const;
attachmentStory.it(
	"fetches the exact turn's paginated fileChange history from an authenticated Cloud connection",
	[],
	function* ({ replyWith, read, requests, protocols }) {
		const items = [
			addedAttachment("evidence.txt", "old\n"),
			...Array.from({ length: 191 }, (_, index) => ({ id: `reasoning-${index}`, type: "reasoning" })),
			{
				changes: [
					{ diff: "@@ -1 +1 @@\n-old\n+final\n", kind: { "move_path": null, type: "update" }, path: `${REPORT_ATTACHMENT_DIRECTORY}evidence.txt` },
				],
				id: "update",
				type: "fileChange",
			},
		];
		yield* replyWith((request) => {
			if (request.method !== "thread/items/list") {
				return {};
			}
			const start = Number(requestCursor(request) ?? 0);
			const end = start + 100;
			return { data: items.slice(start, end).map((item) => ({ item })), nextCursor: end < items.length ? String(end) : null };
		});
		const result = yield* read(observation);
		expect(protocols().some((offered) => offered.includes(`openai-bearer.${syntheticToken("report", FUTURE_EXPIRY)}`))).toBe(true);
		expect(result.files.map(({ path, bytes }) => ({ path, text: new TextDecoder().decode(bytes) }))).toEqual([
			{ path: "evidence.txt", text: "final\n" },
		]);
		expect(result.unavailable).toEqual([]);
		expect(
			requests()
				.filter((request) => request.method === "thread/items/list")
				.map((request) => request.params),
		).toEqual([
			{ cursor: null, limit: 100, sortDirection: "asc", threadId: observation.receipt.sessionId, turnId: observation.receipt.turnId },
			{ cursor: "100", limit: 100, sortDirection: "asc", threadId: observation.receipt.sessionId, turnId: observation.receipt.turnId },
		]);
	},
);

attachmentStory.it("rejects a repeated item cursor rather than replaying a page forever", [], function* ({ replyWith, readItems }) {
	yield* replyWith(() => ({ data: [], nextCursor: "repeated" }));
	expect(yield* readItems(observation.receipt).pipe(Effect.flip)).toMatchObject({ message: "Codex repeated an item pagination cursor" });
});
attachmentStory.it("counts download bytes across item pages", [], function* ({ replyWith, readItems, requests }) {
	yield* replyWith((request) => ({ data: [], nextCursor: requestCursor(request) === null ? "next" : null }));
	expect(yield* readItems(observation.receipt, 50).pipe(Effect.flip)).toMatchObject({
		message: expect.stringContaining("Downloaded report task size limit"),
	});
	expect(
		requests()
			.filter((request) => request.method === "thread/items/list")
			.map((request) => requestCursor(request)),
	).toEqual([null, "next"]);
});
