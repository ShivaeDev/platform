import { type Context, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase, type PostgresTestServices, type PostgresTestTemplate } from "#database.ts";

export const tableNames = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql<{ name: string }>`select table_name as name from information_schema.tables
		where table_schema = 'public' order by table_name`;
	return rows.map(({ name }) => name);
});

export class CloneStory {
	template: PostgresTestTemplate = "migrated";
	services: Context.Context<PostgresTestServices | PostgresTestDatabase> | undefined;

	acquire() {
		const engine = this;
		return Effect.gen(function* () {
			const database = yield* PostgresTestDatabase;
			engine.services = yield* database.clone(engine.template);
		});
	}

	run<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return Effect.suspend(() => {
			if (this.services === undefined) {
				return Effect.die(new Error("Acquire the story database before using its services."));
			}
			return effect.pipe(Effect.provideContext(this.services));
		});
	}
}
