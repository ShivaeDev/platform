import { Duration, Effect } from "effect";
import { readPostgresRelease } from "./postgresRelease.ts";
import { releaseWorkers } from "./releaseWorkers.ts";
import { makeWorkerRelease } from "./WorkerRelease.ts";

export const coordinateWorkerRelease = Effect.fn("EffectSql.coordinateWorkerRelease")(function* (
	release: string,
	pollInterval: Duration.Input = "1 second",
	table = "effect_sql_migrations",
) {
	const gate = yield* makeWorkerRelease();
	const rows = yield* releaseWorkers(release, Duration.toMillis(pollInterval) * 5, table);
	let claimed = false;
	const poll = Effect.gen(function* () {
		const owner = yield* readPostgresRelease(table);
		if (owner?.release !== release) {
			yield* gate.setActive(false).pipe(Effect.orDie);
			yield* rows.remove;
			claimed = false;
		} else if (!claimed) {
			claimed = yield* rows.claim;
			if (claimed) {
				yield* gate.setActive(true).pipe(Effect.orDie);
			}
		}
	});
	yield* Effect.addFinalizer(() => rows.remove.pipe(Effect.orDie));
	// Heartbeats continue while offWork waits for active jobs to finish.
	yield* Effect.forever(Effect.sleep(pollInterval).pipe(Effect.andThen(rows.heartbeat))).pipe(Effect.orDie, Effect.forkScoped);
	yield* poll;
	yield* Effect.forever(Effect.sleep(pollInterval).pipe(Effect.andThen(poll))).pipe(Effect.orDie, Effect.forkScoped);
	return gate.service;
});
