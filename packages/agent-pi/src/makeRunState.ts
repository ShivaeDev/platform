import { Effect, PubSub, Stream } from "effect";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import type { ExecutionState, Receipt } from "@shivaedev/agent/run.ts";
import { rawOf, toAgentEvents } from "#adapters/piEvents.ts";
import type { PiSession } from "#adapters/piRuntime.ts";
export const makeRunState = Effect.fn("Pi.makeRunState")(function* (receipt: Receipt, session: PiSession) {
	const emitted = yield* PubSub.unbounded<RunEvent>();
	const history: RunEvent[] = [];
	let state: typeof ExecutionState.Type = "accepted";
	let disposed = false;
	function publish(event: RunEvent) {
		if (event.type === "execution") {
			state = event.state;
		}
		history.push(event);
		PubSub.publishUnsafe(emitted, event);
	}
	publish({ receipt, type: "acknowledged" });
	publish({
		raw: rawOf("session/opened", { sessionFile: session.sessionFile, sessionId: session.sessionId }),
		reference: session.sessionFile,
		type: "session.opened",
	});
	const unsubscribe = session.subscribe((event) => {
		for (const mapped of toAgentEvents(event)) {
			publish(mapped);
		}
	});
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			disposed = true;
			unsubscribe();
		}).pipe(Effect.andThen(PubSub.shutdown(emitted))),
	);
	return {
		events: Stream.unwrap(
			Effect.gen(function* () {
				const subscription = yield* PubSub.subscribe(emitted);
				return Stream.fromIterable([...history]).pipe(Stream.concat(Stream.fromSubscription(subscription)));
			}),
		),
		inspect: Effect.sync(() => (disposed ? ({ reason: "Pi runtime was disposed", type: "missing" } as const) : ({ state, type: "known" } as const))),
		receipt,
		session,
	};
});
export type RunState = Effect.Success<ReturnType<typeof makeRunState>>;
