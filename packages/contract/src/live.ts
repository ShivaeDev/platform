import { Cause, Effect, Option, Queue, Schema, type Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { Key } from "@shivaedev/changes/keys.ts";
import { clientReadKeys, type KeyContext } from "#clientKeys.ts";
import { liveAttempt } from "#liveAttempt.ts";
import { liveRetry } from "#liveRetry.ts";
import type { SubscriptionEvent } from "#queryUpdate.ts";
import type { QueryReadDenied } from "#readPolicyErrors.ts";
import { retryOnChange } from "#retryOnChange.ts";

export const LiveHint = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("Changed"), keys: Schema.Array(Key) }),
	Schema.Struct({ _tag: Schema.Literal("Resync") }),
]);
export type LiveHint = typeof LiveHint.Type;
export interface LiveStatus<E> {
	readonly connection: "connecting" | "live" | "reconnecting" | "failed";
	readonly failure: Option.Option<Cause.Cause<E | QueryReadDenied>>;
	readonly needsResync: boolean;
	readonly pending: number;
}
export interface LiveOptions<E, R> {
	readonly keyContext?: KeyContext | undefined;
	readonly resume?: Atom.Atom<unknown>;
	readonly retryDelay?: import("effect").Duration.Input;
	readonly retryKeys?: readonly (typeof Key.Type)[];
	readonly stream: Stream.Stream<SubscriptionEvent, E, R>;
}

export function live<R, E, TRuntimeError>(runtime: Atom.AtomRuntime<R, TRuntimeError>, options: LiveOptions<E, R>) {
	const paused = Atom.make(false);
	const status = Atom.make<LiveStatus<E>>({ connection: "connecting", failure: Option.none(), needsResync: true, pending: 0 });
	const connection = runtime
		.atom((get) =>
			Effect.gen(function* () {
				get.mount(status);
				get.mount(paused);
				const resumed = yield* Queue.unbounded<void>();
				yield* retryOnChange(status, clientReadKeys(options.retryKeys ?? [], options.keyContext), () => get.refreshSelf());
				function update(value: Partial<LiveStatus<E>>) {
					get.set(status, { ...get.once(status), ...value });
				}
				get.addFinalizer(() => {
					if (get.registry.getNodes().has(status)) {
						update({ connection: "connecting", failure: Option.none(), needsResync: true, pending: 0 });
					}
				});
				if (options.resume !== undefined) {
					get.once(options.resume);
					get.subscribe(options.resume, () => {
						if (!get.once(paused) && get.once(status).connection !== "failed") {
							Queue.offerUnsafe(resumed, undefined);
						}
					});
				}
				const attempt = liveAttempt(options.stream, {
					delivered: () => update({ connection: "live", failure: Option.none(), needsResync: false, pending: 0 }),
					denied: (denial) => update({ connection: "failed", failure: Option.some(Cause.fail(denial)), needsResync: true, pending: 0 }),
					paused: () => get.once(paused),
					queued: () => update({ connection: "live", needsResync: true, pending: Math.min(256, get.once(status).pending + 1) }),
				});
				yield* liveRetry(
					attempt,
					(failure, retry) => update({ connection: retry ? "reconnecting" : "failed", failure, needsResync: true }),
					options.retryDelay,
					resumed,
				);
			}),
		)
		.pipe(Atom.setIdleTTL(0));
	return { connection, paused, status };
}
