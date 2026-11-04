import { type Cause, Effect, Queue, Stream } from "effect";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import type { Observation, Receipt, StartRequest } from "@shivaedev/agent/run.ts";
import { deliver } from "#adapters/deliver.ts";
import { unavailable } from "#adapters/failure.ts";
import { rawOf, toAgentEvents } from "#adapters/mapping.ts";
import { openRuntime } from "#adapters/runtime.ts";
import type { PiOptions } from "#PiOptions.ts";

export const openSession = Effect.fnUntraced(function* (options: PiOptions, request: StartRequest, resume: string | undefined) {
	const { session, sessionFile } = yield* openRuntime(options, request, resume);
	const output = yield* Queue.unbounded<RunEvent, Cause.Done>();
	let observation: Observation = { state: "accepted", type: "known" };
	function emit(event: RunEvent) {
		if (event.type === "execution") {
			observation = { state: event.state, type: "known" };
		}
		Queue.offerUnsafe(output, event);
	}
	const unsubscribe = session.subscribe((event) => {
		for (const mapped of toAgentEvents(event)) {
			emit(mapped);
		}
	});
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			unsubscribe();
			Queue.endUnsafe(output);
		}),
	);
	const receipt: Receipt = {
		backend: "pi",
		operationId: request.operationId,
		reference: { value: sessionFile, version: 1 },
		session: { value: sessionFile, version: 1 },
	};
	emit({ raw: rawOf("session/opened", { sessionFile, sessionId: session.sessionId }), reference: sessionFile, type: "session.opened" });
	return {
		acknowledge: Effect.sync(() => emit({ receipt, type: "acknowledged" })),
		events: Stream.fromQueue(output),
		inspect: Effect.sync(() => observation),
		interrupt: Effect.tryPromise({ catch: unavailable, try: () => session.abort() }),
		prompt: (text: string, delivery: "followUp" | "steer") => deliver(session, text, delivery),
		receipt,
	};
});
