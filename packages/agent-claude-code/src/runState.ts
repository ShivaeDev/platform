import { Deferred, Effect, Exit, PubSub, Ref, Stream, type Take } from "effect";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import { type ReadFailure, UnknownAcceptance } from "@shivaedev/agent/failures.ts";
import type { ExecutionState, Receipt } from "@shivaedev/agent/run.ts";
import type { SessionConnection } from "#SessionConnection.ts";
export const makeRunState = Effect.fn("ClaudeCode.makeRunState")(function* (operationId: string, session: SessionConnection) {
	const acknowledged = yield* Deferred.make<Receipt, UnknownAcceptance>();
	const history = yield* Ref.make<readonly RunEvent[]>([]);
	const state = yield* Ref.make<typeof ExecutionState.Type>("accepted");
	const terminalSeen = yield* Ref.make(false);
	const failure = yield* Ref.make<ReadFailure | undefined>(undefined);
	const hub = yield* PubSub.unbounded<Take.Take<RunEvent, ReadFailure>>({ replay: Number.POSITIVE_INFINITY });
	function publish(event: RunEvent) {
		return Ref.update(history, (events) => [...events, event]).pipe(Effect.andThen(PubSub.publish(hub, [event])));
	}
	function observe(event: RunEvent) {
		return Effect.gen(function* () {
			if (event.type === "session.opened") {
				const receipt: Receipt = {
					backend: "claude-code",
					operationId,
					reference: { value: operationId, version: 1 },
					session: { value: event.reference, version: 1 },
				};
				if (yield* Deferred.succeed(acknowledged, receipt)) {
					yield* publish({ receipt, type: "acknowledged" });
				}
			}
			if (event.type === "execution") {
				yield* Ref.set(state, event.state);
				if (event.state !== "awaiting-input") {
					yield* Ref.set(terminalSeen, event.state === "completed" || event.state === "failed" || event.state === "interrupted");
				}
			}
			yield* publish(event);
		});
	}
	const consume = session.events.pipe(
		Stream.runForEach(observe),
		Effect.matchEffect({
			onFailure: (error) =>
				Ref.set(failure, error).pipe(
					Effect.andThen(publish({ detail: error.message, kind: "provider-unavailable", type: "gap" })),
					Effect.andThen(PubSub.end(hub, Exit.fail(error))),
				),
			onSuccess: () =>
				Effect.gen(function* () {
					const terminal = yield* Ref.get(terminalSeen);
					if (!terminal) {
						yield* publish({ detail: "The provider stream ended without a terminal turn result", kind: "missing-output", type: "gap" });
					}
					yield* PubSub.end(hub, Exit.void);
				}),
		}),
		Effect.ensuring(
			Deferred.fail(
				acknowledged,
				new UnknownAcceptance({
					backend: "claude-code",
					message: "The provider ended before acknowledging its native session identity",
					operationId,
				}),
			),
		),
		Effect.onInterrupt(() => PubSub.end(hub, Exit.void)),
	);
	yield* Effect.forkScoped(consume);
	return { acknowledged, events: Stream.fromPubSubTake(hub), failure, history, session, state };
});
export type RunState = Effect.Success<ReturnType<typeof makeRunState>>;
