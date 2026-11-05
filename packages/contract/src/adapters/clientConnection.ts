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
	const status = Atom.make((get): ConnectionStatus => {
		get.mount(debounced);
		const context = AsyncResult.value(get(runtime));
		if (Option.isSome(context)) {
			const cancel = Effect.runCallbackWith(context.value)(
				activity.pipe(
					Stream.map((state) => state.connectionStatus),
					Stream.changes,
					Stream.runForEach((value) => Effect.sync(() => get.setSelf(value))),
				),
			);
			get.addFinalizer(cancel);
		}
		return Effect.runSync(activity.current).connectionStatus;
	});
	return { status, statuses };
}
