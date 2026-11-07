import { Clock, Duration, Effect } from "effect";
import { sendHostMessage } from "#host/adapters/process.ts";
import { listenHostReadouts } from "#host/adapters/processReadouts.ts";
import { HostProcessError } from "#host/ProcessError.ts";

export const hostProcessReadouts = Effect.gen(function* () {
	const active = new Map<symbol, string>();
	const finalizers: string[] = [];
	let shutdownDuration: number | null = null;
	let shutdownWork: readonly string[] | undefined;
	function read() {
		return { activeWork: shutdownWork ?? [...active.values()], finalizers: [...finalizers], shutdownDuration, type: "host-readouts" as const };
	}
	function finishShutdown(started: bigint) {
		return Effect.gen(function* () {
			shutdownDuration = Duration.toMillis(Duration.nanos((yield* Clock.currentTimeNanos) - started));
			yield* Effect.tryPromise({
				catch: (cause) => new HostProcessError({ cause, operation: "readout" }),
				try: () => sendHostMessage(read()),
			}).pipe(Effect.orDie);
		});
	}
	yield* Effect.acquireRelease(
		Effect.sync(() => listenHostReadouts(read)),
		(close) => Effect.sync(close),
	);
	return {
		finalizer: <A, E, R>(name: string, effect: Effect.Effect<A, E, R>) => effect.pipe(Effect.ensuring(Effect.sync(() => finalizers.push(name)))),
		shutdown: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
			Effect.gen(function* () {
				shutdownWork = [...active.values()];
				const started = yield* Clock.currentTimeNanos;
				return yield* effect.pipe(Effect.ensuring(finishShutdown(started)));
			}),
		work: <A, E, R>(name: string, effect: Effect.Effect<A, E, R>) =>
			Effect.acquireUseRelease(
				Effect.sync(() => {
					const id = Symbol(name);
					active.set(id, name);
					return id;
				}),
				() => effect,
				(id) => Effect.sync(() => active.delete(id)),
			),
	};
});
