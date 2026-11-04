import { Deferred, Effect, Fiber, Queue, Stream } from "effect";
import type { CodexState } from "#test/codexState.ts";
import { currentReceipt } from "#test/currentReceipt.ts";
import { supported } from "#test/supported.ts";
export function codexObservations(state: CodexState) {
	const readEvents = Effect.fn("Story.readEvents")(function* (count: number) {
		const ready = yield* Deferred.make<void>();
		const events = state.backend.events(currentReceipt(state)).pipe(
			Stream.tap((event) => (event.type === "acknowledged" ? Deferred.succeed(ready, undefined) : Effect.void)),
			Stream.take(count),
		);
		const fiber = yield* Effect.forkScoped(Stream.runCollect(events));
		yield* Deferred.await(ready);
		return fiber;
	});
	return {
		census: () => state.runtime.census("root"),
		inspect: () => state.backend.inspect(currentReceipt(state)),
		join: <A, E>(fiber: Fiber.Fiber<A, E>) => Fiber.join(fiber),
		models: () => supported(state.backend.features.models).list,
		readEvents,
		replies: () => Effect.sync(() => state.peer.replies),
		reply: () => Queue.take(state.peer.answered),
		requests: (method?: string) =>
			Effect.sync(() => state.peer.frames.filter((frame) => frame.method !== undefined && (method === undefined || frame.method === method))),
		submissionReceived: () => Deferred.await(state.peer.submitted),
		toolStarted: () => Deferred.await(state.toolStarted),
		transcript: () => supported(state.backend.features.transcript).read(currentReceipt(state)),
		waitForRequest: (method: string) => Queue.take(state.peer.received).pipe(Effect.repeat({ until: (frame) => frame.method === method })),
	};
}
