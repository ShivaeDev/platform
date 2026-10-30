import { Deferred, Effect, Exit, Layer, Redacted, Scope } from "effect";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase } from "#database.ts";
import type { CleanupEngine } from "./cleanup.ts";
import { attempt } from "./outcome.ts";

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
		cloneDatabase: () => exists(state.clone),
		cloneDatabaseOnceDrained: () =>
			Effect.andThen(engine.run(Effect.flatMap(PostgresTestDatabase, (database) => database.awaitCleanup)), exists(state.clone)),
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
		crashedWorkerDatabases: () =>
			Effect.gen(function* () {
				const remaining = new Set(yield* engine.databaseNames());
				return state.crashed.all
					.filter((name) => remaining.has(name))
					.map((name) => (name === state.crashed.shared ? "its shared database" : "its empty template"))
					.sort();
			}),
		firstDropAttempt: () => Deferred.await(state.firstDropAttempt),
		leftover: () => exists(state.leftover),
		otherHostsDatabase: () => exists(state.otherHost),
		runClosing: () => Effect.sync(() => closing),
		startAnotherRun: () => {
			story.tell("another run starts on this host");
			return Effect.scoped(Layer.build(engine.fixture.layer));
		},
		startRun: () => {
			story.tell("the run starts");
			return engine.lease();
		},
	};
}
