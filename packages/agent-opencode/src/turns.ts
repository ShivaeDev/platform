import { Deferred, Effect, Ref, Semaphore } from "effect";
import type { BackendFailure } from "@shivaedev/agent/failures.ts";
import type { SessionFrame } from "#sessionFrames.ts";
import type { TurnRequests } from "#turnRequests.ts";
import {
	closed,
	idle,
	type OpenTurnState,
	type PendingText,
	rested,
	running,
	SESSION_CLOSED,
	sent,
	type TurnState,
	withPending,
} from "#turnState.ts";

function refuse(next: PendingText, failure: BackendFailure) {
	return Deferred.fail(next.accepted, failure).pipe(Effect.andThen(Effect.logWarning("opencode: queued prompt failed", failure)));
}
export interface TurnDriver {
	readonly close: Effect.Effect<void>;
	readonly interrupt: Effect.Effect<void, BackendFailure>;
	readonly queue: (text: string) => Effect.Effect<void, BackendFailure>;
	readonly steer: (text: string) => Effect.Effect<void, BackendFailure>;
	readonly track: (frame: SessionFrame) => Effect.Effect<void>;
}
export const makeTurnDriver = Effect.fnUntraced(function* (requests: TurnRequests) {
	const state = yield* Ref.make<TurnState>(idle);
	const gate = yield* Semaphore.make(1);
	function sendNow(text: string) {
		return requests.prompt(text).pipe(Effect.andThen(Ref.update(state, (current) => (current._tag === "closed" ? current : running(current)))));
	}
	function flush(current: OpenTurnState) {
		const [next] = current.pending;
		if (next === undefined) {
			return Effect.void;
		}
		return sendNow(next.text).pipe(
			Effect.matchEffect({
				onFailure: (failure) => Ref.update(state, sent).pipe(Effect.andThen(refuse(next, failure))),
				onSuccess: () => Ref.update(state, sent).pipe(Effect.andThen(Deferred.succeed(next.accepted, undefined))),
			}),
			Effect.asVoid,
		);
	}
	function admit(text: string, accepted: PendingText["accepted"]) {
		return Effect.flatMap(Ref.get(state), (current) => {
			if (current._tag === "closed") {
				return Deferred.fail(accepted, SESSION_CLOSED);
			}
			if (current.running) {
				return Ref.set(state, withPending(current, { accepted, text }));
			}
			return sendNow(text).pipe(
				Effect.matchEffect({
					onFailure: (failure) => Deferred.fail(accepted, failure),
					onSuccess: () => Deferred.succeed(accepted, undefined),
				}),
			);
		});
	}
	const queue = Effect.fnUntraced(function* (text: string) {
		const accepted = yield* Deferred.make<void, BackendFailure>();
		yield* gate.withPermit(admit(text, accepted));
		yield* Deferred.await(accepted);
	});
	function steer(text: string) {
		return Effect.flatMap(Ref.get(state), (current) => (current._tag === "closed" ? Effect.fail(SESSION_CLOSED) : sendNow(text)));
	}
	const settled = Effect.flatMap(Ref.get(state), (current) =>
		current._tag === "closed" ? Effect.void : Ref.set(state, rested(current)).pipe(Effect.andThen(flush(rested(current)))),
	);
	const close = Ref.getAndSet(state, closed).pipe(
		Effect.flatMap((current) =>
			current._tag === "closed"
				? Effect.void
				: Effect.forEach(current.pending, (waiting) => Deferred.fail(waiting.accepted, SESSION_CLOSED)).pipe(Effect.asVoid),
		),
	);
	yield* Effect.addFinalizer(() => close);
	return {
		close,
		interrupt: Effect.asVoid(requests.abort),
		queue,
		steer: (text) => gate.withPermit(steer(text)),
		track: (frame) => (frame.type === "session.idle" ? gate.withPermit(settled) : Effect.void),
	} satisfies TurnDriver;
});
