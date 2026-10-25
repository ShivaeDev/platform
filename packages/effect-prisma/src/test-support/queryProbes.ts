import { Effect, Exit, Fiber } from "effect";
import type { QueryControl } from "#test/queryControls.ts";
import { controlledUsers } from "#test/queryControls.ts";
import { queryStreamProbes } from "#test/queryStreamProbes.ts";
import { Database } from "#test/sqlite/database.ts";

export function controlledQuery(db: Effect.Success<typeof Database>) {
	return db.User.where((user) => user.email.in(controlledUsers.map((seed) => seed.email)))
		.orderBy((user) => user.name.asc())
		.select("id");
}
export function queryProbes(db: Effect.Success<typeof Database>, state: () => QueryControl) {
	return {
		...queryStreamProbes(db, state),
		interrupt: () =>
			db.transaction(
				Effect.gen(function* () {
					const query = controlledQuery(yield* Database);
					const control = state();
					const first = yield* Effect.forkChild(query, { startImmediately: true });
					yield* control.first.wait;
					const interruption = yield* Effect.forkChild(Fiber.interrupt(first), { startImmediately: true });
					const second = yield* Effect.forkChild(query, { startImmediately: true });
					yield* Effect.yieldNow;
					const attemptsBeforeRelease = control.started;
					const queriesBeforeRelease = [...control.startedQueries];
					control.release();
					yield* Fiber.join(interruption);
					return { attemptsBeforeRelease, queriesBeforeRelease, rows: yield* Fiber.join(second) };
				}),
			),
		retry: () =>
			db.transaction(
				Effect.gen(function* () {
					const query = controlledQuery(yield* Database);
					const failed = Exit.isFailure(yield* Effect.exit(query));
					return { failed, rows: yield* query };
				}),
			),
		serialized: () =>
			db.transaction(
				Effect.gen(function* () {
					const query = controlledQuery(yield* Database);
					const control = state();
					const fiber = yield* Effect.forkChild(Effect.all([query, query], { concurrency: "unbounded" }), { startImmediately: true });
					yield* control.first.wait;
					yield* Effect.yieldNow;
					const startedBeforeRelease = control.started;
					const queriesBeforeRelease = [...control.startedQueries];
					control.release();
					const results = yield* Fiber.join(fiber);
					return {
						concurrentQueries: control.concurrentQueries,
						maximumActive: control.maximumActive,
						queriesBeforeRelease,
						results,
						startedBeforeRelease,
					};
				}),
			),
	};
}
