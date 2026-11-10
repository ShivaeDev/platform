import { Deferred, Effect, Semaphore } from "effect";
import { type BackendFailure, BackendUnavailable } from "@shivaedev/agent/failures.ts";
import type { Input } from "@shivaedev/agent/run.ts";

interface Pending {
	readonly accepted: Deferred.Deferred<void, BackendFailure>;
	readonly input: Input;
}
interface State {
	active: string | undefined;
	closed: boolean;
	finished: Map<string, Deferred.Deferred<void, BackendFailure>>;
	pending: Pending[];
	uncertain: string | undefined;
}
export const deliveryState = Effect.gen(function* () {
	const gate = yield* Semaphore.make(1);
	const state: State = { active: undefined, closed: false, finished: new Map(), pending: [], uncertain: undefined };
	const close = Effect.gen(function* () {
		state.closed = true;
		const error = new BackendUnavailable({ backend: "codex", message: "Session closed before delivery reached Codex" });
		for (const next of state.pending.splice(0)) {
			yield* Deferred.fail(next.accepted, error);
		}
		for (const signal of state.finished.values()) {
			yield* Deferred.fail(signal, error);
		}
	});
	const queue = Effect.fn("Codex.queue")(function* (input: Input, flush: Effect.Effect<void>) {
		const accepted = yield* Deferred.make<void, BackendFailure>();
		yield* Semaphore.withPermit(gate)(
			Effect.gen(function* () {
				if (state.closed) {
					return yield* new BackendUnavailable({ backend: "codex", message: "Session closed before delivery reached Codex" });
				}
				state.pending.push({ accepted, input });
				yield* flush;
			}),
		);
		yield* Deferred.await(accepted);
	});
	return { close, gate, queue, state };
});
