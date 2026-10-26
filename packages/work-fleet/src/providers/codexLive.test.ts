import { expect } from "@effect/vitest";
import { TestClock } from "effect/testing";
import type { WireRequest } from "#test/codex.ts";
import { cloudThread } from "#test/codexCloud.ts";
import { cloudProvider, timedProviderStory } from "#test/providerStory.ts";

const receipt = { sessionId: "synthetic-session", turnId: "synthetic-turn" };
function runningTurn(request: WireRequest) {
	switch (request.method) {
		case "thread/turns/list":
			return { data: [{ id: receipt.turnId, items: [], status: "inProgress" }], nextCursor: null };
		case "thread/items/list":
			return { data: [], nextCursor: null };
		case "thread/resume":
			return cloudThread();
		default:
			return {};
	}
}

timedProviderStory.it(
	"a running Cloud turn reports its live events and follows the thread again after a reconnect",
	[cloudProvider],
	function* ({ provider, replyWith, emitThreadEvent, dropConnections, requests, handshakes }) {
		yield* replyWith(runningTurn);
		expect((yield* provider.observe(receipt)).activityAt).toBeUndefined();
		yield* TestClock.adjust("1 minute");
		yield* emitThreadEvent(receipt.sessionId, "item/agentMessage/delta");
		const first = (yield* provider.observe(receipt)).activityAt;
		expect(first).toEqual(expect.any(Number));
		yield* emitThreadEvent(receipt.sessionId, "account/rateLimits/updated");
		yield* emitThreadEvent("other-session", "item/agentMessage/delta");
		yield* TestClock.adjust("1 minute");
		expect((yield* provider.observe(receipt)).activityAt).toBe(first);
		yield* dropConnections();
		yield* provider.observe(receipt);
		yield* TestClock.adjust("1 minute");
		yield* emitThreadEvent(receipt.sessionId, "item/commandExecution/outputDelta");
		expect((yield* provider.observe(receipt)).activityAt).toBe((first ?? 0) + 2 * 60_000);
		expect(handshakes()).toHaveLength(2);
		expect(
			requests()
				.filter((request) => request.method === "thread/resume")
				.map((request) => request.params),
		).toEqual([
			{ excludeTurns: true, threadId: receipt.sessionId },
			{ excludeTurns: true, threadId: receipt.sessionId },
		]);
	},
);
