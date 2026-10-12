import { Effect } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { SqlClient } from "effect/unstable/sql";
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";

export const makeFleetTransaction = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const current = yield* Effect.serviceOption(Reactivity.Reactivity);
	const reactivity = current._tag === "Some" ? current.value : yield* Reactivity.make;
	return <A, E, R>(table: string, body: Effect.Effect<A, E, R>) =>
		transact(
			Effect.tap(body, () => invalidateOnCommit([table])),
			{ onSqlError: (error) => error },
		).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.provideService(Reactivity.Reactivity, reactivity));
});
