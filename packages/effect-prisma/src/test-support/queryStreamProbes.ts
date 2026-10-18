import { Effect, Stream } from "effect";
import { controlledUsers, type QueryControl } from "#test/queryControls.ts";
import { Database } from "#test/sqlite/database.ts";

export function queryStreamProbes(db: Effect.Success<typeof Database>, state: () => QueryControl) {
	function source(database: Effect.Success<typeof Database>) {
		return database.User.where((user) => user.email.in(controlledUsers.map((seed) => seed.email)))
			.orderBy((user) => user.name.asc())
			.select("id", "name");
	}
	return {
		buffered: () =>
			db.transaction(
				Effect.gen(function* () {
					const database = yield* Database;
					const rows = yield* Stream.runCollect(
						source(database).stream.pipe(Stream.mapEffect((row) => database.User.where({ id: row.id }).exists())),
					);
					return { events: state().events, rows };
				}),
			),
		incremental: () =>
			Effect.gen(function* () {
				const rows = yield* Stream.runCollect(
					source(db).stream.pipe(
						Stream.map((row) => {
							state().events.push(`downstream:${row.name}`);
							return { id: row.id };
						}),
					),
				);
				return { events: state().events, rows };
			}),
	};
}
