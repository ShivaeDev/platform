import { Clock, Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { Conflict, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { waitForResponse } from "#server/responses/waitFor.ts";
import { recordedEdgeResponse, responseWorkspace } from "#test/responseEdges.ts";
import { waitReplies } from "#test/waitReplies.ts";

let workspace: Effect.Success<ReturnType<typeof responseWorkspace>>;

it.live("preserves a nonretryable external RPC rejection without polling it again", function* () {
	const failure = new Conflict({ message: "The registered question identity is ambiguous; response history is unknown." });
	const rpc = waitReplies([Effect.fail(failure)]);
	expect(yield* Effect.flip(waitForResponse(rpc.read, () => undefined))).toMatchObject({ _tag: failure._tag, message: failure.message });
	expect(rpc.calls()).toBe(1);
});

it.live("reconnects after repeated external service failures and reports one outage before the reply arrives", function* () {
	workspace = yield* responseWorkspace();
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
			const fiber = yield* waitForResponse(rpc.read, (text) => diagnostics.push(text)).pipe(Effect.forkChild);
			yield* TestClock.adjust("1999 millis");
			expect(rpc.calls()).toBe(1);
			yield* TestClock.adjust("1 millis");
			expect(rpc.calls()).toBe(2);
			yield* TestClock.adjust("2 seconds");
			return yield* Fiber.join(fiber);
		}),
	).pipe(Effect.provide(TestClock.layer()));
	expect(yield* waiting).toEqual({ kind: "response", question, response });
	expect(rpc.calls()).toBe(4);
	expect(diagnostics).toEqual(["Local service unavailable; reconnecting to the same question."]);
});

it.live("does not invent an unanswered verdict when transport fails after the known durable deadline", function* () {
	workspace = yield* responseWorkspace();
	const registered = yield* Effect.promise(() => workspace.register());
	const question = { ...registered, question: { ...registered.question, deadline: (yield* Clock.currentTimeMillis) - 1 } };
	const rpc = waitReplies([Effect.succeed({ expired: false, question }), Effect.fail(new ServiceUnavailable({ message: "Connection lost." }))]);
	expect((yield* Effect.flip(waitForResponse(rpc.read, () => undefined))).message).toContain(
		"The service is unavailable at the deadline; unanswered status could not be verified. Re-read this question when it returns.",
	);
	expect(rpc.calls()).toBe(2);
});
