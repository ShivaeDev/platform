import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { invalidationKeys, type Key } from "@shivaedev/effect-contract/keys.ts";
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";
import { retryAdmission } from "#storage/admissionLock.ts";

export const makeFleetTransaction = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const current = yield* Effect.serviceOption(Reactivity.Reactivity);
	const reactivity = current._tag === "Some" ? current.value : yield* Reactivity.make;
	return <A, E, R>(keys: readonly Key[], body: Effect.Effect<A, E, R>) =>
		retryAdmission(
			transact(
				Effect.tap(body, () => invalidateOnCommit(invalidationKeys(keys))),
				{ onSqlError: (error) => error },
			),
		).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.provideService(Reactivity.Reactivity, reactivity));
});
