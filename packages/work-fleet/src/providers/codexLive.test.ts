import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { cloudThread } from "#test/codexCloud.ts";
import { cloudProvider, timedProviderStory } from "#test/providerStory.ts";
import { page, turn } from "#test/wireScript.ts";

const RECEIPT = { sessionId: "synthetic-session", turnId: "synthetic-turn" };
const RUNNING = { "thread/items/list": page([]), "thread/resume": cloudThread(), "thread/turns/list": page([turn(RECEIPT.turnId, "inProgress")]) };
const MINUTE = 60_000;

timedProviderStory.it(
	"only agent output on the observed thread moves a running Cloud turn's activity time",
	[cloudProvider],
	function* ({ answers, emitThreadEvent, minutePasses, provider }) {
		yield* answers(RUNNING);
		const subscribed = yield* provider.observe(RECEIPT);
		expect(subscribed.activityAt).toBeUndefined();
		yield* minutePasses();
		yield* emitThreadEvent(RECEIPT.sessionId, "item/agentMessage/delta");
		const active = (yield* provider.observe(RECEIPT)).activityAt;
		expect(active).toBe((subscribed.subscribedAt ?? 0) + MINUTE);
		yield* minutePasses();

		yield* emitThreadEvent(RECEIPT.sessionId, "account/rateLimits/updated");
		yield* emitThreadEvent("other-session", "item/agentMessage/delta");

		expect((yield* provider.observe(RECEIPT)).activityAt).toBe(active);
	},
);

timedProviderStory.it(
	"after the provider drops its connection, the next observation resubscribes the thread and counts its events again",
	[cloudProvider],
	function* ({ answers, dropConnections, emitThreadEvent, handshakes, minutePasses, provider, sent }) {
		yield* answers(RUNNING);
		const subscribed = yield* provider.observe(RECEIPT);
		yield* minutePasses();

		yield* dropConnections();

		const resubscribed = yield* provider.observe(RECEIPT);
		expect(resubscribed.subscribedAt).toBe((subscribed.subscribedAt ?? 0) + MINUTE);
		yield* minutePasses();
		yield* emitThreadEvent(RECEIPT.sessionId, "item/commandExecution/outputDelta");
		yield* outcomes([
			["activity", () => provider.observe(RECEIPT).pipe(Effect.map(({ activityAt }) => activityAt)), (subscribed.subscribedAt ?? 0) + 2 * MINUTE],
			["connections", () => handshakes(), 2],
			[
				"thread subscriptions",
				() => sent("thread/resume"),
				[
					{ excludeTurns: true, threadId: RECEIPT.sessionId },
					{ excludeTurns: true, threadId: RECEIPT.sessionId },
				],
			],
		]);
	},
);
