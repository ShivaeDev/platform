import { Duration, Effect, Exit, Predicate, Schedule, Scope } from "effect";
import { isSqlError } from "effect/sql/SqlError";
import { readPostgresRelease } from "./postgresRelease.ts";
import { releaseWorkers } from "./releaseWorkers.ts";
import { makeWorkerRelease } from "./WorkerRelease.ts";

function isCloseable(scope: Scope.Scope): scope is Scope.Closeable {
	return Predicate.hasProperty(scope, "~effect/Scope/Closeable") && scope["~effect/Scope/Closeable"] === "~effect/Scope/Closeable";
}

export const coordinateWorkerRelease = Effect.fn("EffectSql.coordinateWorkerRelease")(function* (
	release: string,
	pollInterval: Duration.Input = "1 second",
	table = "effect_sql_migrations",
) {
	const gate = yield* makeWorkerRelease();
	const owningScope = yield* Effect.scope;
	if (!isCloseable(owningScope)) {
		return yield* Effect.die(new Error("Worker release coordination requires a closeable owning scope"));
	}
	const scope = owningScope;
	const retries = Schedule.spaced(Duration.toMillis(pollInterval) / 4).pipe(Schedule.upTo({ times: 3 }));
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
	function tick<A, E, R>(name: string, effect: Effect.Effect<A, E, R>) {
		return effect.pipe(
			Effect.tapCause((cause) => Effect.logWarning(`Worker release ${name} failed`, cause)),
			Effect.retry({ schedule: retries, while: isSqlError }),
		);
	}
	function loop<E, R>(name: string, effect: Effect.Effect<unknown, E, R>) {
		return Effect.forever(Effect.sleep(pollInterval).pipe(Effect.andThen(tick(name, effect)))).pipe(
			Effect.catchCause((cause) =>
				Effect.logError(`Worker release ${name} stopped; closing worker scope`, cause).pipe(
					Effect.andThen(Scope.close(scope, Exit.failCause(cause))),
				),
			),
			Scope.provide(scope),
			Effect.forkIn(scope),
		);
	}
	yield* Scope.addFinalizer(
		scope,
		gate.setActive(false).pipe(
			Effect.orDie,
			Effect.andThen(rows.remove),
			Effect.tapCause((cause) => Effect.logError("Worker release cleanup failed", cause)),
			Effect.orDie,
		),
	);
	// Heartbeats continue while offWork waits for active jobs to finish.
	yield* loop("heartbeat", rows.heartbeat);
	yield* tick("poll", poll).pipe(Scope.provide(scope));
	yield* loop("poll", poll);
	return gate.service;
});
