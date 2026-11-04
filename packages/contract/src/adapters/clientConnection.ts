import { Effect, Layer, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type { ConnectionStatus } from "#clientActivity.ts";
import type { LiveStatus } from "#live.ts";

export function clientConnection(factory: Atom.RuntimeFactory, publish: (status: ConnectionStatus) => void) {
	const statuses = Atom.make<ReadonlyMap<object, LiveStatus<unknown>>>(new Map());
	const current = Atom.map(
		statuses,
		(values): ConnectionStatus =>
			[...values.values()].some(({ connection }) => connection === "connecting" || connection === "reconnecting") ? "reconnecting" : "live",
	);
	const debounced = factory(Layer.empty).atom((get) =>
		get.stream(current).pipe(
			Stream.changes,
			Stream.debounce("300 millis"),
			Stream.tap((value) => Effect.sync(() => publish(value))),
			Stream.ensuring(Effect.sync(() => publish("live"))),
		),
	);
	const status = Atom.map(debounced, (result) => Option.getOrElse(AsyncResult.value(result), (): ConnectionStatus => "live"));
	return { status, statuses };
}
