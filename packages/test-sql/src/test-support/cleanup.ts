import { execFile } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Clock, Context, Deferred, Effect, Exit, Fiber, Layer, Redacted, Scope, type Tracer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as TestClock from "effect/testing/TestClock";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase } from "#database.ts";
import { databaseId } from "#internal/databaseOwner.ts";
import { cleanupRole, cleanupVerbs } from "./cleanupVerbs.ts";
import { createDatabaseEngine, type DatabaseEngine } from "./databaseEngine.ts";
import { limitedRole } from "./limitedRole.ts";
import { outcomeOf } from "./outcome.ts";
import { adminUrl, configured } from "./postgres.ts";

export interface CleanupEngine {
	clone: string;
	readonly cloneScope: Scope.Closeable;
	crashed: { readonly shared: string; readonly all: readonly string[] };
	readonly engine: DatabaseEngine;
	readonly firstDropAttempt: Deferred.Deferred<string>;
	leftover: string;
	otherHost: string;
	readonly roleScope: Scope.Closeable;
}

const run = promisify(execFile);

export const cleanup = storyKit({
	clock: "live",
	create: () =>
		Effect.gen(function* () {
			const roleScope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
			const engine = yield* createDatabaseEngine;
			const cloneScope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
			const firstDropAttempt = yield* Deferred.make<string>();
			const state: CleanupEngine = {
				clone: "",
				cloneScope,
				crashed: { all: [], shared: "" },
				engine,
				firstDropAttempt,
				leftover: "",
				otherHost: "",
				roleScope,
			};
			return state;
		}),
	inspect: ({ clone, crashed, leftover, otherHost }) => ({ clone, crashed, leftover, otherHost }),
	layer: PgClient.layer({ url: adminUrl }).pipe(Layer.provideMerge(Reactivity.layer)),
	name: "database cleanup",
	runIf: configured,
	stages: ["configuration", "run", "activity"],
	verbs: cleanupVerbs,
});

function dropOnStoryEnd(state: CleanupEngine, name: string) {
	const admin = state.engine.admin;
	return Effect.addFinalizer(() => Effect.orDie(admin`drop database if exists ${admin(name)} with (force)`));
}

export const limitedCleanupRole = cleanup.trait(
	"configuration",
	"the run's role may open 2 connections and cannot drop other owners' databases",
	function* (state) {
		state.engine.options = { ...state.engine.options, url: yield* limitedRole(2).pipe(Effect.provideService(Scope.Scope, state.roleScope)) };
	},
);

export const unownedLeftover = cleanup.trait("configuration", "an earlier run left a database in the older unowned naming format", function* (state) {
	const admin = state.engine.admin;
	state.leftover = `effect_test_${yield* databaseId}`;
	yield* admin`create database ${admin(state.leftover)}`;
	yield* dropOnStoryEnd(state, state.leftover);
});

export const otherHostDatabase = cleanup.trait(
	"configuration",
	"a worker on another host, whose process id is not running here, owns a database",
	function* (state) {
		const admin = state.engine.admin;
		const { stdout: pid } = yield* Effect.promise(() => run(process.execPath, ["--eval", "process.stdout.write(String(process.pid))"]));
		state.otherHost = `effect_test_00000000_${pid}_${yield* databaseId}`;
		yield* admin`create database ${admin(state.otherHost)}`;
		yield* dropOnStoryEnd(state, state.otherHost);
	},
);

export const crashedRun = cleanup.trait(
	"configuration",
	"a worker on this host exited without closing its run, leaving its databases",
	function* (state) {
		const { stdout } = yield* Effect.promise(() =>
			run(process.execPath, ["--conditions=source", fileURLToPath(new URL("./crashedDatabase.ts", import.meta.url))]),
		);
		const admin = state.engine.admin;
		const owner = stdout.slice(0, stdout.lastIndexOf("_") + 1);
		const rows = yield* admin<{ datname: string }>`select datname from pg_database where starts_with(datname, ${owner}) order by datname`;
		state.crashed = { all: rows.map(({ datname }) => datname), shared: stdout };
		for (const name of state.crashed.all) {
			yield* dropOnStoryEnd(state, name);
		}
	},
);

export const runStarted = cleanup.trait("run", "the run has started", (state) => state.engine.lease());

function openClone(state: CleanupEngine) {
	return state.engine.run(
		Effect.gen(function* () {
			const database = yield* PostgresTestDatabase;
			const context = yield* database.isolated.pipe(Effect.provideService(Scope.Scope, state.cloneScope));
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
