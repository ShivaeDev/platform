import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { boardReadStory, hasBoardItems } from "#test/boardReadStory.ts";

boardReadStory.it("rejects oversized reports including attachment links before writing an attachments folder", [hasBoardItems(1)], function* (kit) {
	const observation = { execution: "completed", output: "x", provisioning: "unknown", receipt: { sessionId: "worker", turnId: "small" } } as const;
	const work = yield* kit.board.get("item.0");
	const report = yield* kit.board.report(work, observation);
	const small = (yield* kit.board.get(report.itemId)).context;
	const available = 256 * 1024 - new TextEncoder().encode(small).length + 1;
	const exact = "界".repeat(Math.floor(available / 3)) + "x".repeat(available % 3);
	for (const output of [exact, "界".repeat((256 * 1024) / 3)]) {
		const failure = yield* kit
			.reportWithAttachments(work, { ...observation, output, receipt: { ...observation.receipt, turnId: "large" } })
			.pipe(Effect.flip);
		expect(failure.message).toContain("256 KiB");
		expect(kit.responseFiles()).toEqual([`${report.itemId}.md`]);
	}
});
