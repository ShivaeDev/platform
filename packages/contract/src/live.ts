import { Cause, Duration, Effect, Option, Schema, type Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { invalidationKeys, Key, type KeyContext, readKeys } from "@shivaedev/changes/keys.ts";
import { liveAttempt } from "#internal/liveAttempt.ts";
import { invalidateLive } from "#internal/liveInvalidation.ts";
import { livePending } from "#internal/livePending.ts";
import { liveRetry } from "#internal/liveRetry.ts";
import { retryOnChange } from "#internal/retryOnChange.ts";
import type { SubscriptionHint } from "#queryUpdate.ts";
import type { QueryReadDenied } from "#readPolicyErrors.ts";

export const LiveHint = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("Changed"), keys: Schema.Array(Key), queryIndexes: Schema.optional(Schema.Array(Schema.Number)) }),
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
	readonly coalesceWindow?: Duration.Input;
	readonly initialResync?: boolean;
	readonly keyContext?: KeyContext | undefined;
	readonly resume?: Atom.Atom<unknown>;
	readonly resyncKeys: readonly Key[] | ((registry: AtomRegistry.AtomRegistry) => readonly Key[]);
	readonly retryDelay?: Duration.Input;
	readonly retryKeys?: readonly Key[];
	readonly stream: Stream.Stream<SubscriptionHint, E, R>;
}

const MAX_PENDING = 256;

export function live<R, E, TRuntimeError>(runtime: Atom.AtomRuntime<R, TRuntimeError>, options: LiveOptions<E, R>) {
	const coalesceWindow = Atom.keepAlive(Atom.make<Duration.Input>(options.coalesceWindow ?? "20 millis"));
	const paused = Atom.make(false);
	const status = Atom.make<LiveStatus<E>>({ connection: "connecting", failure: Option.none(), needsResync: true, pending: 0 });
	const connection = runtime
		.atom((get) =>
			Effect.gen(function* () {
				get.mount(status);
				const reactivity = yield* Reactivity.Reactivity;
				const retryKeys = options.retryKeys ?? (typeof options.resyncKeys === "function" ? options.resyncKeys(get.registry) : options.resyncKeys);
				yield* retryOnChange(status, readKeys(retryKeys, options.keyContext), () => get.refreshSelf());
				function update(value: Partial<LiveStatus<E>>) {
					get.set(status, { ...get.once(status), ...value });
				}
				function flush() {
					const queued = pending.take();
					if (!get.once(paused)) {
						invalidateLive(reactivity, queued, () => active && !get.once(paused));
					}
				}
				const timer = runtime.fn((delay: Duration.Input) => Effect.andThen(Effect.sleep(delay), Effect.sync(flush)));
				get.mount(timer);
				const pending = livePending(
					(window) => get.set(timer, window),
					() => get.set(timer, Atom.Interrupt),
				);
				let active = true;
				get.addFinalizer(() => {
					active = false;
					pending.clear();
					if (get.registry.getNodes().has(status)) {
						update({ connection: "connecting", failure: Option.none(), needsResync: true, pending: 0 });
					}
				});
				function changed(changedKeys: readonly Key[]) {
					const window = get.once(coalesceWindow);
					const keys = invalidationKeys(changedKeys, options.keyContext);
					invalidateLive(reactivity, keys, () => active && !get.once(paused), window);
					const delay = Duration.toMillis(Duration.fromInputUnsafe(window));
					if (delay === 0) {
						invalidateLive(reactivity, keys, () => active && !get.once(paused));
						return;
					}
					pending.add(keys, window);
				}
				function resync() {
					if (get.once(status).connection === "failed") {
						return;
					}
					pending.clear();
					if (get.once(paused)) {
						update({ needsResync: true });
						return;
					}
					const keys = typeof options.resyncKeys === "function" ? options.resyncKeys(get.registry) : options.resyncKeys;
					reactivity.invalidateUnsafe(keys.map((key) => readKeys([key], options.keyContext)[0] ?? ""));
					update({ needsResync: false, pending: 0 });
				}
				// A subscription alone does not build the flag, so its first read would otherwise announce a change.
				get.once(paused);
				get.subscribe(paused, (value) => {
					if (!value) {
						resync();
					}
				});
				if (options.resume !== undefined) {
					// A subscription alone does not initialize a derived signal's dependencies.
					get.once(options.resume);
					get.subscribe(options.resume, resync);
				}
				const attempt = liveAttempt(options.stream, {
					changed,
					denied: (denial) => {
						pending.clear();
						update({ connection: "failed", failure: Option.some(Cause.fail(denial)), needsResync: true, pending: 0 });
					},
					live: () => update({ connection: "live", failure: Option.none() }),
					paused: () => get.once(paused),
					queued: () => update({ needsResync: true, pending: Math.min(MAX_PENDING, get.once(status).pending + 1) }),
					reconcile: (connected) => {
						if (connected || options.initialResync !== false) {
							resync();
						} else {
							update({ needsResync: false });
						}
					},
				});
				yield* liveRetry(
					attempt,
					(failure, retry) => {
						update({ connection: retry ? "reconnecting" : "failed", failure, needsResync: true });
					},
					options.retryDelay,
				);
			}),
		)
		.pipe(Atom.setIdleTTL(0));
	return { coalesceWindow, connection, paused, status };
}
