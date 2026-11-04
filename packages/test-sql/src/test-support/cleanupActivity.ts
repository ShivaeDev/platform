import { Clock, Context, Deferred, Effect, Exit, Fiber, Redacted, Scope, type Tracer } from "effect";
import { SqlClient } from "effect/sql";
import * as TestClock from "effect/testing/TestClock";
import { PostgresTestDatabase } from "#server/database.ts";
import { CleanupClock } from "#server/internal/clocks.ts";
import { type CleanupEngine, cleanup } from "./cleanup.ts";
import { cleanupRole, dropOnStoryEnd } from "./cleanupVerbs.ts";
import { outcomeOf } from "./outcome.ts";

export const runStarted = cleanup.trait("run", "the run has started", (state) =>
	state.engine.lease().pipe(Effect.provideService(CleanupClock, state.cleanupClock)),
);

function openClone(state: CleanupEngine) {
	return state.engine.run(
		Effect.gen(function* () {
			const database = yield* PostgresTestDatabase;
			const context = yield* database.isolated.pipe(Effect.provideService(Scope.Scope, state.cloneScope));
			yield* Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select 1`).pipe(Effect.provideContext(context));
			state.clone = new URL(Redacted.value(Context.get(context, PostgresTestDatabase).url)).pathname.slice(1);
			yield* dropOnStoryEnd(state, state.clone);
		}),
	);
}

export const cloneOpen = cleanup.trait("activity", "a story has opened a clone", openClone);

export const cloneOpenUnderPausedClock = cleanup.trait("activity", "a story whose test clock stays paused has opened a clone", function* (state) {
	const clock = yield* TestClock.make();
	yield* Effect.addFinalizer(() => clock.adjust("1 minute"));
	yield* openClone(state).pipe(Effect.provideService(Clock.Clock, clock));
});

export const dropsBlocked = cleanup.trait("activity", "another session holds a lock on pg_database that blocks every drop", function* (state) {
	const admin = state.engine.admin;
	const held = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const holder = yield* admin
		.withTransaction(
			Effect.gen(function* () {
				yield* admin`lock table pg_database in share mode`;
				yield* Deferred.succeed(held, undefined);
				yield* Deferred.await(release);
			}),
		)
		.pipe(Effect.orDie, Effect.forkScoped);
	yield* Effect.addFinalizer(() => Effect.andThen(Deferred.succeed(release, undefined), Fiber.join(holder)));
	yield* Deferred.await(held);
});

export const cloneClosed = cleanup.trait("activity", "the story has closed its clone's scope, which queues the clone's drop", (state) =>
	Scope.close(state.cloneScope, Exit.void),
);

export const dropDenied = cleanup.trait("activity", "the clone now belongs to another owner, so the run's role may not drop it", (state) => {
	const admin = state.engine.admin;
	return admin`alter database ${admin(state.clone)} owner to postgres`;
});

function watchingDrops(state: CleanupEngine, tracer: Tracer.Tracer): Tracer.Tracer {
	return {
		span(options) {
			const span = tracer.span(options);
			if (options.name !== "PostgresTest.administer") {
				return span;
			}
			return new Proxy(span, {
				get(target, key) {
					if (key === "end") {
						return (endTime: bigint, exit: Exit.Exit<unknown, unknown>) => {
							target.end(endTime, exit);
							Deferred.doneUnsafe(state.firstDropAttempt, Effect.succeed(outcomeOf(exit)));
						};
					}
					return Reflect.get(target, key, target);
				},
			});
		},
	};
}

export const dropRefusedForLackOfConnections = cleanup.trait(
	"activity",
	"the run's role has no connections left when the story closes its clone's scope, so the first drop attempt is refused",
	function* (state) {
		const admin = state.engine.admin;
		const role = cleanupRole(state);
		yield* admin`alter role ${admin(role)} connection limit 0`;
		yield* Effect.addFinalizer(() => Effect.orDie(admin`alter role ${admin(role)} connection limit 2`));
		const tracer = yield* Effect.tracer;
		yield* Scope.close(state.cloneScope, Exit.void).pipe(Effect.withTracer(watchingDrops(state, tracer)));
		yield* Deferred.await(state.firstDropAttempt);
	},
);
