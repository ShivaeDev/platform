import * as NodeServices from "@effect/platform-node/NodeServices";
import { Clock, Console, Effect, Stream } from "effect";
import { daemonClient } from "#host/daemonClient.ts";
import { readDaemonPort } from "#host/daemonPort.ts";
import { type EventKind, type WatchEvent, watchTransitions } from "#host/watchEvents.ts";
import type { WatchSnapshot, WatchState } from "#host/watchState.ts";

export interface WatchStreamOptions {
	readonly board: string;
	readonly events: readonly EventKind[];
	readonly intervalMs: number;
	readonly port?: number;
	readonly stuckMs: number;
	readonly timeoutMs?: number;
	readonly workIds: readonly string[];
}

export const watchStream = Effect.fn("FleetWatch.watchStream")(function* (options: WatchStreamOptions) {
	const transitions = watchTransitions(options.stuckMs);
	let seenAt = yield* Clock.currentTimeMillis;
	let unreachable = false;
	let epoch: string | undefined;
	let states: readonly WatchState[] | undefined;
	function print(event: WatchEvent) {
		return options.events.some((kind) => kind === event.kind) || event.kind.startsWith("daemon-") ? Console.log(JSON.stringify(event)) : Effect.void;
	}
	const receive = Effect.fnUntraced(function* (snapshot: typeof WatchSnapshot.Type) {
		const now = yield* Clock.currentTimeMillis;
		if (epoch !== undefined && epoch !== snapshot.epoch) {
			if (!unreachable) {
				yield* print({ kind: "daemon-unreachable" });
			}
			unreachable = true;
			states = undefined;
			transitions.reset();
		}
		if (unreachable) {
			yield* print({ kind: "daemon-back" });
		}
		unreachable = false;
		epoch = snapshot.epoch;
		seenAt = now;
		if (snapshot.states) {
			states = snapshot.states;
			for (const event of transitions.update(states, now)) {
				yield* print(event);
			}
		}
	});
	const health = Effect.gen(function* () {
		if (!unreachable && (yield* Clock.currentTimeMillis) - seenAt >= 3000) {
			unreachable = true;
			yield* print({ kind: "daemon-unreachable" });
		}
		if (!unreachable && states) {
			for (const event of transitions.update(states, yield* Clock.currentTimeMillis)) {
				yield* print(event);
			}
		}
	}).pipe(Effect.andThen(Effect.sleep("100 millis")), Effect.forever);
	const connect = Effect.gen(function* () {
		const port = yield* readDaemonPort(options.board, options.port).pipe(Effect.provide(NodeServices.layer));
		yield* Stream.unwrap(daemonClient(port).pipe(Effect.map((client) => client("daemon.watch", { workIds: options.workIds })))).pipe(
			Stream.timeout("3 seconds"),
			Stream.runForEach(receive),
		);
	}).pipe(
		Effect.scoped,
		Effect.catch(() => Effect.void),
		Effect.andThen(Effect.sleep(options.intervalMs)),
		Effect.forever,
	);
	const consume = Effect.all([connect, health], {
		concurrency: "unbounded",
		discard: true,
	});
	if (options.timeoutMs === undefined) {
		yield* consume;
		return 0;
	}
	yield* Effect.raceFirst(consume, Effect.sleep(options.timeoutMs));
	return 4;
});
