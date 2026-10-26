import { Clock, Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { ServiceUnavailable } from "@shivaedev/contract/errors/taxonomy.ts";
import { waitForResponse } from "#server/responses/waitFor.ts";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { recordedEdgeResponse } from "#test/responseEdges.ts";
import { waitReplies } from "#test/waitReplies.ts";

boardStory.it(
	"reconnects after repeated external service failures and reports one outage before the reply arrives",
	[aQuestionnaire()],
	function* ({ workspace }) {
		const question = yield* Effect.promise(() => workspace.register());
		const response = recordedEdgeResponse(question);
		const unavailable = Effect.fail(new ServiceUnavailable({ message: "The workspace could not be indexed." }));
		const rpc = waitReplies([
			unavailable,
			unavailable,
			Effect.succeed({ expired: false, question }),
			Effect.succeed({ expired: false, question, response }),
		]);
		const diagnostics: string[] = [];
		const waiting = Effect.scoped(
			Effect.gen(function* () {
				const start = yield* Clock.currentTimeMillis;
				const fiber = yield* waitForResponse(rpc.read, (text) => diagnostics.push(text)).pipe(Effect.forkChild);
				yield* TestClock.adjust("1999 millis");
				expect(rpc.requestedAt()).toEqual([start]);
				yield* TestClock.adjust("1 millis");
				expect(rpc.requestedAt()).toEqual([start, start + 2000]);
				yield* TestClock.adjust("2 seconds");
				const result = yield* Fiber.join(fiber);
				expect(rpc.requestedAt()).toEqual([start, start + 2000, start + 4000, start + 4000]);
				return result;
			}),
		).pipe(Effect.provide(TestClock.layer()));
		expect(yield* waiting).toEqual({ kind: "response", question, response });
		expect(diagnostics).toEqual(["Local service unavailable; reconnecting to the same question."]);
	},
);

boardStory.it(
	"does not invent an unanswered verdict when transport fails after the known durable deadline",
	[aQuestionnaire()],
	function* ({ workspace }) {
		const registered = yield* Effect.promise(() => workspace.register());
		const question = { ...registered, question: { ...registered.question, deadline: (yield* Clock.currentTimeMillis) - 1 } };
		const replies = [Effect.succeed({ expired: false, question }), Effect.fail(new ServiceUnavailable({ message: "Connection lost." }))];
		const rpc = waitReplies(replies);
		const failure = yield* Effect.flip(waitForResponse(rpc.read, () => undefined));
		expect(failure).toBeInstanceOf(ServiceUnavailable);
		expect(failure.message).toContain(
			"The service is unavailable at the deadline; unanswered status could not be verified. Re-read this question when it returns.",
		);
		expect(rpc.requestedReplies()).toEqual(replies);
	},
);
