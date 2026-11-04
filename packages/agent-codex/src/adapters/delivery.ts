import { Deferred, Effect, Schema, Semaphore } from "effect";
import { type BackendFailure, BackendUnavailable, Rejected, UnknownAcceptance } from "@shivaedev/agent/failures.ts";
import type { ImageInput, Input } from "@shivaedev/agent/run.ts";
import { deliveryState } from "#adapters/deliveryState.ts";
import { TurnNotification } from "#adapters/protocol.ts";
import type { RpcNotification } from "#adapters/rpc.ts";
import { AppServer } from "#adapters/server.ts";
import { turnRequests } from "#adapters/turnRequests.ts";
export const delivery = Effect.fn("Codex.delivery")(function* (
	threadId: string,
	settings: { model?: string; effort?: string },
	remember: (operationId: string) => void,
) {
	const server = yield* AppServer;
	const { state, gate, close, queue } = yield* deliveryState;
	const requests = yield* turnRequests(threadId, settings);
	function closedError() {
		return new BackendUnavailable({ backend: "codex", message: "Session closed before delivery reached Codex" });
	}
	const start = Effect.fn("Codex.start")(function* (input: ImageInput, operationId: string) {
		if (state.closed) {
			return yield* closedError();
		}
		if (state.uncertain !== undefined) {
			return yield* new UnknownAcceptance({
				backend: "codex",
				message: "Reconcile the previous submission before sending another turn",
				operationId: state.uncertain,
			});
		}
		remember(operationId);
		state.active = yield* requests.start(input, operationId).pipe(
			Effect.tapError((error) =>
				Effect.sync(() => {
					if (error._tag !== "Rejected") {
						state.uncertain = operationId;
					}
				}),
			),
		);

		if (!state.finished.has(state.active)) {
			state.finished.set(state.active, yield* Deferred.make<void, BackendFailure>());
		}
		return state.active;
	});
	const flush = Effect.gen(function* () {
		if (state.active !== undefined || state.uncertain !== undefined || state.closed) {
			return;
		}
		const next = state.pending.shift();
		if (next === undefined) {
			return;
		}
		yield* start(next.input, next.input.id ?? crypto.randomUUID()).pipe(
			Effect.matchEffect({
				onFailure: (error) => Deferred.fail(next.accepted, error),
				onSuccess: () => Deferred.succeed(next.accepted, undefined),
			}),
		);
	});
	const settle = Effect.fn("Codex.settle")(function* (turnId: string) {
		if (state.active !== turnId) {
			return;
		}
		state.active = undefined;
		const signal = state.finished.get(turnId);
		if (signal !== undefined) {
			yield* Deferred.succeed(signal, undefined);
		}
		yield* flush;
	});
	const track = Effect.fn("Codex.track")(function* (notification: RpcNotification) {
		const value = Schema.decodeUnknownOption(TurnNotification)(notification.params);
		if (value._tag === "None" || value.value.threadId !== threadId) {
			return;
		}
		const id = value.value.turn.id;
		if (notification.method === "turn/completed") {
			yield* settle(id);
			return;
		}
		if (notification.method !== "turn/started") {
			return;
		}
		state.active = id;
		if (!state.finished.has(id)) {
			state.finished.set(id, yield* Deferred.make<void, BackendFailure>());
		}
	});

	yield* Effect.addFinalizer(() => close);
	yield* Effect.forkScoped(server.exited.pipe(Effect.andThen(close)));

	return {
		interrupt: (turnId: string) =>
			Effect.gen(function* () {
				if (state.active !== turnId) {
					return;
				}
				const outcome = yield* requests.interrupt(turnId);
				if (outcome === "inactive") {
					yield* Semaphore.withPermit(gate)(settle(turnId));
				}
				const signal = state.finished.get(turnId);
				if (signal !== undefined) {
					yield* Deferred.await(signal);
				}
			}),
		queue: (input: Input) => queue(input, flush),
		recovered: (turnId: string, running: boolean) =>
			Semaphore.withPermit(gate)(
				Effect.gen(function* () {
					state.active = running ? turnId : undefined;
					state.uncertain = undefined;
					if (running && !state.finished.has(turnId)) {
						state.finished.set(turnId, yield* Deferred.make<void, BackendFailure>());
					}
					yield* flush;
				}),
			),
		start: (input: ImageInput, operationId: string) => Semaphore.withPermit(gate)(start(input, operationId)),
		steer: (expected: string, input: Input) =>
			Semaphore.withPermit(gate)(
				Effect.gen(function* () {
					if (state.active !== expected) {
						return yield* new Rejected({ backend: "codex", message: "The expected turn is no longer active" });
					}
					const operationId = input.id ?? crypto.randomUUID();
					remember(operationId);
					yield* requests.steer(expected, input, operationId);
				}),
			),
		track: (notification: RpcNotification) => Semaphore.withPermit(gate)(track(notification)),
	};
});
export type Delivery = Effect.Success<ReturnType<typeof delivery>>;
