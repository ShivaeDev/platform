import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { codexTurns } from "#providers/codexTurns.ts";
import { REPORT_ATTACHMENT_DIRECTORY } from "#reportAttachments.ts";
import { addedAttachment, turnDownload } from "#test/reportAttachments.ts";

const observation = {
	execution: "completed",
	output: "Report",
	provisioning: "unknown",
	receipt: { sessionId: "synthetic-session", turnId: "synthetic-turn" },
} as const;
it.live("fetches the exact turn's paginated fileChange history from an authenticated Cloud connection", () =>
	Effect.gen(function* () {
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
		const download = yield* turnDownload(items);
		const result = yield* download.read(observation);
		expect(download.authenticated()).toBe(true);
		expect(result.files.map(({ path, bytes }) => ({ path, text: new TextDecoder().decode(bytes) }))).toEqual([
			{ path: "evidence.txt", text: "final\n" },
		]);
		expect(result.unavailable).toEqual([]);
		expect(download.requests.filter((request) => request.method === "thread/items/list").map((request) => request.params)).toEqual([
			{ cursor: null, limit: 100, sortDirection: "asc", threadId: observation.receipt.sessionId, turnId: observation.receipt.turnId },
			{ cursor: "100", limit: 100, sortDirection: "asc", threadId: observation.receipt.sessionId, turnId: observation.receipt.turnId },
		]);
	}).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("rejects a repeated item cursor rather than replaying a page forever", function* () {
	const { readItems } = codexTurns(() => Effect.succeed({ data: [], nextCursor: "repeated" }));
	expect(yield* readItems(observation.receipt).pipe(Effect.flip)).toMatchObject({ message: "Codex repeated an item pagination cursor" });
});
it.effect("counts download bytes across item pages", function* () {
	let page = 0;
	const { readItems } = codexTurns(() => {
		page += 1;
		return Effect.succeed({ data: [], nextCursor: page === 1 ? "next" : null });
	});
	expect(yield* readItems(observation.receipt, 50).pipe(Effect.flip)).toMatchObject({
		message: expect.stringContaining("Downloaded report task size limit"),
	});
});
