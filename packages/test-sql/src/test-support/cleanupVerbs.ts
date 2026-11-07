import { Clock, Deferred, Effect, Exit, Layer, Redacted, Scope } from "effect";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { CleanupClock } from "#server/clocks.ts";
import { PostgresTestDatabase } from "#server/database.ts";
import { observeUntil } from "#server/observeUntil.ts";
import type { CleanupEngine } from "#test/cleanup.ts";
import { attempt } from "#test/outcome.ts";

export function dropOnStoryEnd(state: CleanupEngine, name: string) {
	const admin = state.engine.admin;
	return Effect.addFinalizer(() => Effect.orDie(admin`drop database if exists ${admin(name)} with (force)`));
}

export function cleanupRole(state: CleanupEngine) {
	return new URL(Redacted.value(state.engine.options.url)).username;
}

export function cleanupVerbs(state: CleanupEngine, story: Story<CleanupEngine>) {
	const { engine } = state;
	const admin = engine.admin;
	function exists(name: string) {
		return Effect.map(admin`select 1 from pg_database where datname = ${name}`, (rows) => (rows.length > 0 ? "exists" : "dropped"));
	}
	let closing = "not closed";
	return {
		awaitCleanup: () => {
			story.tell("the story awaits the run's cleanup");
			return engine.run(Effect.flatMap(PostgresTestDatabase, (database) => database.awaitCleanup));
		},
		cleanupRetryIntervalPasses: () => {
			story.tell("the run's 100 millisecond cleanup retry interval passes");
			return Effect.gen(function* () {
				yield* untilTimer("100 millis").pipe(Effect.provideService(Clock.Clock, state.cleanupClock));
				yield* state.cleanupClock.adjust("100 millis");
			});
		},
		cloneDatabase: () => {
			story.tell("the story checks whether its clone still exists");
			return exists(state.clone);
		},
		cloneDatabaseOnceDrained: () => {
			story.tell("the story awaits cleanup and checks whether its clone still exists");
			return Effect.andThen(engine.run(Effect.flatMap(PostgresTestDatabase, (database) => database.awaitCleanup)), exists(state.clone));
		},
		cloneSessions: () => {
			story.tell("the story reads the clone's session names from PostgreSQL");
			return Effect.map(admin<{ name: string }>`select application_name as name from pg_stat_activity where datname = ${state.clone}`, (rows) =>
				rows.map(({ name }) => name),
			);
		},
		closeClone: () => {
			story.tell("the story closes its clone's scope");
			return Scope.close(state.cloneScope, Exit.void);
		},
		closeRun: () => {
			story.tell("the run closes");
			return Effect.map(attempt(engine.close()), (outcome) => {
				closing = outcome;
			});
		},
		connectionsReturn: () => {
			story.tell("the run's role may open 2 connections again");
			return admin`alter role ${admin(cleanupRole(state))} connection limit 2`;
		},
		crashedWorkerDatabases: () => {
			story.tell("the story checks which databases remain from the crashed worker");
			return Effect.gen(function* () {
				const remaining = new Set(yield* engine.databaseNames());
				return state.crashed.all
					.filter((name) => remaining.has(name))
					.map((name) => (name === state.crashed.shared ? "its shared database" : "its empty template"))
					.sort();
			});
		},
		firstDropAttempt: () => {
			story.tell("the story waits for the first clone drop attempt");
			return Deferred.await(state.firstDropAttempt);
		},
		leftover: () => {
			story.tell("the story checks whether the leftover database exists");
			return exists(state.leftover);
		},
		otherHostsDatabase: () => {
			story.tell("the story checks whether the other host’s database exists");
			return exists(state.otherHost);
		},
		pendingDropSessions: () => {
			story.tell("the story reads the blocked clone drop's application name from PostgreSQL");
			const sessions = admin<{ name: string }>`select application_name as name from pg_stat_activity
				where query like 'drop database if exists%' and strpos(query, ${state.clone}) > 0 and wait_event_type = 'Lock'`;
			return Effect.map(
				observeUntil(sessions, (rows) => rows.length > 0, "the clone's drop to block"),
				(rows) => rows.map(({ name }) => name),
			);
		},
		runClosing: () => {
			story.tell("the story reads the run closing outcome");
			return Effect.sync(() => closing);
		},
		startAnotherRun: () => {
			story.tell("another run starts on this host");
			return Effect.scoped(Layer.build(engine.fixture.layer));
		},
		startRun: () => {
			story.tell("the run starts");
			return engine.lease().pipe(Effect.provideService(CleanupClock, state.cleanupClock));
		},
	};
}
