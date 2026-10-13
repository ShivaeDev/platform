import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";
import { PostgresTestDatabase } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { secondClient, values } from "./postgres.ts";

export function committingClone(value: string, names: string[]) {
	return withIsolatedDatabase(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const reactivity = yield* Reactivity.Reactivity;
			const events: number[] = [];
			const unregister = reactivity.registerUnsafe(["items"], () => events.push(1));
			yield* Effect.addFinalizer(() => Effect.sync(unregister));
			const [row] = yield* sql<{ name: string }>`select current_database() as name`;
			const name = row?.name ?? "";
			names.push(name);
			expect(yield* values).toEqual([{ value: "seed" }]);
			const database = yield* PostgresTestDatabase;
			const other = yield* secondClient(database.url);
			yield* transact(
				Effect.gen(function* () {
					yield* sql`update items set value = ${value}`;
					yield* invalidateOnCommit(["items"]);
				}),
				{ onSqlError: (error) => error },
			);
			expect(yield* other`select value from items`).toEqual([{ value }]);
			expect(events).toEqual([1]);
		}),
	);
}
