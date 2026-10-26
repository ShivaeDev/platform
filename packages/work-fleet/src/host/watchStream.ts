import * as NodeServices from "@effect/platform-node/NodeServices";
import { Clock, Console, Effect, Stream } from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
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
	let unreachable = false;
	let outageEpoch: string | undefined;
	let epoch: string | undefined;
	let states: readonly WatchState[] | undefined;
	function print(event: WatchEvent) {
		return Effect.gen(function* () {
			if (!(options.events.some((kind) => kind === event.kind) || event.kind.startsWith("daemon-"))) {
				return;
			}
			if (event.kind === "stuck" && event.workId !== undefined) {
				const workId = event.workId;
				const pickedUp = yield* Effect.scoped(
					Effect.gen(function* () {
						const port = yield* readDaemonPort(options.board, options.port).pipe(Effect.provide(NodeServices.layer));
						const client = yield* daemonClient(port);
						return yield* client("daemon.check-stuck", { workId });
					}),
				).pipe(Effect.orElseSucceed(() => false));
				if (pickedUp) {
					return;
				}
			}
			yield* Console.log(JSON.stringify(event));
		});
	}
	const receive = Effect.fnUntraced(function* (snapshot: typeof WatchSnapshot.Type) {
		const now = yield* Clock.currentTimeMillis;
		if (epoch !== undefined && epoch !== snapshot.epoch) {
			if (outageEpoch !== epoch) {
				yield* print({ kind: "daemon-unreachable" });
				yield* print({ kind: "daemon-back" });
			}
			states = undefined;
			transitions.reset();
		}
		epoch = snapshot.epoch;
		if (snapshot.states) {
			states = snapshot.states;
			for (const event of transitions.update(states, now)) {
				yield* print(event);
			}
		}
	});
	const health = Effect.gen(function* () {
		if (!unreachable && states) {
			for (const event of transitions.update(states, yield* Clock.currentTimeMillis)) {
				yield* print(event);
			}
		}
	}).pipe(Effect.andThen(Effect.sleep("100 millis")), Effect.forever);
	const liveness = Effect.gen(function* () {
		const alive = yield* Effect.gen(function* () {
			const port = yield* readDaemonPort(options.board, options.port).pipe(Effect.provide(NodeServices.layer));
			const response = yield* HttpClient.get(`http://127.0.0.1:${port}/live`);
			return response.status === 204;
		}).pipe(
			Effect.timeout("1 second"),
			Effect.orElseSucceed(() => false),
		);
		if (!alive) {
			outageEpoch = epoch;
		}
		if (unreachable !== !alive) {
			unreachable = !alive;
			yield* print({ kind: alive ? "daemon-back" : "daemon-unreachable" });
		}
	}).pipe(Effect.provide(FetchHttpClient.layer), Effect.andThen(Effect.sleep("500 millis")), Effect.forever);
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
	const consume = Effect.all([connect, health, liveness], {
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
