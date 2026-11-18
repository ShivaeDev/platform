import { Effect, Layer, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type { ClientActivityState, ConnectionStatus } from "#clientActivity.ts";
import type { LiveStatus } from "#live.ts";

export function clientConnection(
	factory: Atom.RuntimeFactory,
	publish: (status: ConnectionStatus) => void,
	activity: Stream.Stream<ClientActivityState> & { readonly current: Effect.Effect<ClientActivityState> },
) {
	const statuses = Atom.make<ReadonlyMap<object, LiveStatus<unknown>>>(new Map());
	const current = Atom.map(
		statuses,
		(values): ConnectionStatus =>
			[...values.values()].some(({ connection }) => connection === "connecting" || connection === "reconnecting") ? "reconnecting" : "live",
	);
	const runtime = factory(Layer.empty);
	const debounced = Atom.make((get): ConnectionStatus => {
		const context = AsyncResult.value(get(runtime));
		if (Option.isNone(context)) {
			return "live";
		}
		const cancel = Effect.runCallbackWith(context.value)(
			get.stream(current).pipe(
				Stream.changes,
				Stream.debounce("300 millis"),
				Stream.runForEach((value) =>
					Effect.sync(() => {
						publish(value);
						get.setSelf(value);
					}),
				),
				Effect.ensuring(Effect.sync(() => publish("live"))),
			),
		);
		get.addFinalizer(cancel);
		return "live";
	});
	function follow<A>(select: (state: ClientActivityState) => A, mounts: readonly Atom.Atom<unknown>[] = []) {
		return Atom.make((get): A => {
			for (const mounted of mounts) {
				get.mount(mounted);
			}
			const context = AsyncResult.value(get(runtime));
			if (Option.isSome(context)) {
				const cancel = Effect.runCallbackWith(context.value)(
					activity.pipe(
						Stream.map(select),
						Stream.changes,
						Stream.runForEach((value) => Effect.sync(() => get.setSelf(value))),
					),
				);
				get.addFinalizer(cancel);
			}
			return select(Effect.runSync(activity.current));
		});
	}
	return {
		firstSettled: follow((state) => state.firstSettled),
		status: follow((state) => state.connectionStatus, [debounced]),
		statuses,
	};
}
