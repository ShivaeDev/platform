import { type Cause, type Duration, Effect, Option, Schema, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
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
	readonly resume?: Atom.Atom<unknown>;
	readonly resyncKeys: readonly Key[];
	readonly retryDelay?: Duration.Input;
	readonly stream: Stream.Stream<LiveHint, E, R>;
}

const MAX_PENDING = 256;

export function live<R, E, TRuntimeError>(runtime: Atom.AtomRuntime<R, TRuntimeError>, options: LiveOptions<E, R>) {
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
				function resync() {
					if (get.once(paused)) {
						update({ needsResync: true });
						return;
					}
					reactivity.invalidateUnsafe(readKeys(options.resyncKeys));
					update({ needsResync: false, pending: 0 });
				}
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
							reactivity.invalidateUnsafe(invalidationKeys(hint.keys));
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
	return { connection, paused, status };
}
