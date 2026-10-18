import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { transact } from "@shivaedev/effect-sql/transact.ts";
import { NotesService } from "#server/NotesService.ts";
import type { RunningHost } from "./host.ts";

export const createInRolledBackTransaction = Effect.fn("AppStory.createInRolledBackTransaction")(function* (
	host: RunningHost,
	tell: (line: string) => void,
) {
	tell("create a note inside an outer transaction that rolls back");
	const sql = yield* SqlClient.SqlClient;
	const users = yield* sql<{ id: string }>`select id from "user" where email = 'alice@app.test'`;
	const ownerId = users[0]?.id;
	if (ownerId === undefined) {
		return yield* Effect.die("Missing account");
	}
	const result = yield* Effect.gen(function* () {
		const service = yield* NotesService;
		yield* service.create({ title: "Rolled back" }, ownerId);
		return yield* Effect.fail("rollback");
	}).pipe(transact({ onSqlError: (error) => error }), Effect.provide(host.context), Effect.result);
	return result;
});
