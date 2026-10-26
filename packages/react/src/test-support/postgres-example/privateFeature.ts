import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { contract } from "@shivaedev/contract/contract.ts";
import { collection, invalidationKeys } from "@shivaedev/contract/keys.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { Identity } from "@shivaedev/platform/rpc/identity.ts";
import { Authenticated } from "@shivaedev/platform/rpc/middleware.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { Rejected } from "./contract.ts";

const preferences = collection("preferences", Schema.Number);
export const Preferences = contract("preferences", {
	commands: [
		command("save", {
			invalidates: () => [preferences.item(0)],
			payload: { title: Schema.String },
			rejections: { Rejected },
			success: Schema.String,
		}),
	],
	keyScope: "session",
	queries: [
		query("self", { reads: () => [preferences.item(0)], success: Schema.String }),
		query("list", { reads: () => [preferences.list], success: Schema.Array(Schema.String) }),
	],
}).middleware(Authenticated);

export function privateHandlers(table: string, beforeCommit: Effect.Effect<void, Rejected> = Effect.void) {
	const read = Effect.gen(function* () {
		const { id } = yield* Identity;
		const sql = yield* SqlClient.SqlClient;
		const rows = yield* sql<{ readonly name: string }>`select name from ${sql(table)} where "ownerId" = ${id}`.pipe(Effect.orDie);
		return rows[0]?.name ?? "Unset";
	});
	return Preferences.application.toLayer({
		"preferences.list": () => Effect.map(read, (title) => [title]),
		"preferences.save": ({ title }) =>
			Effect.gen(function* () {
				const { id } = yield* Identity;
				const sql = yield* SqlClient.SqlClient;
				return yield* Effect.gen(function* () {
					yield* sql`update ${sql(table)} set name = ${title} where "ownerId" = ${id}`;
					yield* invalidateOnCommit(invalidationKeys([preferences.item(0)], { scope: id }));
					yield* beforeCommit;
					return title;
				}).pipe(transact({ onSqlError: (error) => error }), Effect.catchTag("SqlError", Effect.die));
			}),
		"preferences.self": () => read,
	});
}
