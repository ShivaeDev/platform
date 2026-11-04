import { expect } from "@effect/vitest";
import { codex } from "#test/codexStory.ts";

codex.it("transcripts retain command input and failed command output", [], function* ({ start, sendItem, transcript }) {
	yield* start();
	yield* sendItem({
		aggregatedOutput: "check failed",
		command: "pnpm check",
		cwd: "/project",
		exitCode: 2,
		id: "command",
		status: "completed",
		type: "commandExecution",
	});

	const result = yield* transcript();

	expect(result).toMatchObject({
		completeness: "complete",
		events: [
			{ role: "user", type: "message" },
			{ input: "pnpm check", name: "commandExecution", toolId: "command", type: "tool.started" },
			{ ok: false, output: "check failed", toolId: "command", type: "tool.completed" },
		],
	});
});

codex.it("unmapped provider items retain their raw content", [], function* ({ start, readEvents, sendItem, join }) {
	yield* start();
	const pending = yield* readEvents(3);

	yield* sendItem({ id: "future-item", opaque: "keep this provider content", type: "futureProviderItem" });

	expect(yield* join(pending)).toMatchObject([
		{ type: "acknowledged" },
		{ type: "session.opened" },
		{ raw: { kind: "item/completed", payload: expect.stringContaining("keep this provider content"), source: "codex" }, type: "raw" },
	]);
});

codex.it("usage events report provider cumulative session totals", [], function* ({ start, readEvents, notify, join }) {
	yield* start();
	const pending = yield* readEvents(3);

	yield* notify("thread/tokenUsage/updated", {
		threadId: "root",
		tokenUsage: {
			last: { cachedInputTokens: 3, inputTokens: 10, outputTokens: 2 },
			total: { cachedInputTokens: 30, inputTokens: 100, outputTokens: 20 },
		},
		turnId: "turn-1",
	});

	expect(yield* join(pending)).toMatchObject([
		{ type: "acknowledged" },
		{ type: "session.opened" },
		{ cacheReadTokens: 30, inputTokens: 100, outputTokens: 20, scope: "cumulative", type: "usage", unit: "session" },
	]);
});
