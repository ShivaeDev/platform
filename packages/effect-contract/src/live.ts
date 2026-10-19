import { type Cause, Duration, Effect, Option, Schema, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as Reactivity from "effect/reactivity/Reactivity";
import { invalidateLive } from "#internal/liveInvalidation.ts";
import { invalidationKeys, Key, readKeys } from "./keys.ts";

export const LiveHint = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("Changed"), keys: Schema.Array(Key) }),
	Schema.Struct({ _tag: Schema.Literal("Resync") }),
]);
export type LiveHint = typeof LiveHint.Type;
export interface LiveStatus<E> {
	readonly connection: "connecting" | "live" | "reconnecting";
	readonly failure: Option.Option<Cause.Cause<E>>;
	readonly needsResync: boolean;
	readonly pending: number;
}
export interface LiveOptions<E, R> {
	readonly coalesceWindow?: Duration.Input;
	readonly resume?: Atom.Atom<unknown>;
	readonly resyncKeys: readonly Key[] | (() => readonly Key[]);
	readonly retryDelay?: Duration.Input;
	readonly stream: Stream.Stream<LiveHint, E, R>;
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
				function update(value: Partial<LiveStatus<E>>) {
					get.set(status, { ...get.once(status), ...value });
				}
				const pending = new Set<string>();
				let timer: ReturnType<typeof setTimeout> | undefined;
				function clear() {
					clearTimeout(timer);
					timer = undefined;
					pending.clear();
				}
				let active = true;
				get.addFinalizer(() => {
					active = false;
					clear();
				});
				function changed(changedKeys: readonly Key[]) {
					const window = get.once(coalesceWindow);
					const keys = invalidationKeys(changedKeys);
					invalidateLive(reactivity, keys, () => active && !get.once(paused), window);
					const delay = Duration.toMillis(Duration.fromInputUnsafe(window));
					if (delay === 0) {
						invalidateLive(reactivity, keys, () => active && !get.once(paused));
						return;
					}
					for (const key of invalidationKeys(changedKeys)) {
						pending.add(key);
					}
					timer ??= setTimeout(() => {
						const queued = [...pending];
						clear();
						if (!get.once(paused)) {
							invalidateLive(reactivity, queued, () => active && !get.once(paused));
						}
					}, delay);
				}
				function resync() {
					clear();
					if (get.once(paused)) {
						update({ needsResync: true });
						return;
					}
					reactivity.invalidateUnsafe(readKeys(typeof options.resyncKeys === "function" ? options.resyncKeys() : options.resyncKeys));
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
				const attempt = Effect.suspend(() => {
					let isFirst = true;
					function observe(hint: LiveHint) {
						update({ connection: "live", failure: Option.none() });
						if (get.once(paused)) {
							update({ needsResync: true, pending: Math.min(MAX_PENDING, get.once(status).pending + 1) });
						} else if (isFirst || hint._tag === "Resync") {
							resync();
						} else {
							changed(hint.keys);
						}
						isFirst = false;
					}
					return options.stream.pipe(
						Stream.runForEach((hint) => Effect.sync(() => observe(hint))),
						Effect.scoped,
						Effect.catchCause((failure) => Effect.sync(() => update({ failure: Option.some(failure) }))),
						Effect.andThen(Effect.sync(() => update({ connection: "reconnecting", needsResync: true }))),
						Effect.andThen(Effect.sleep(options.retryDelay ?? "1 second")),
					);
				});
				yield* Effect.forever(attempt);
			}),
		)
		.pipe(Atom.setIdleTTL(0));
	return { coalesceWindow, connection, paused, status };
}
