import { Effect, Option } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { invalidationKeys, type Key } from "@shivaedev/changes/keys.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import type { BetterAuthDatabaseHooks } from "#server/better-auth/databaseHooks.ts";
import { sessionKeys } from "#signedInSessions.ts";
import { userKeys } from "#users.ts";

// Inside an application transaction the nested transact joins its commit; otherwise it is a transaction of its own after Better Auth's commit.
// An announcement that fails must not fail an auth write that may already have committed.
// A user change also announces the sessions list, which shows each session's user name and email.
const announce = Effect.fnUntraced(function* (keys: readonly Key[]) {
	const sql = yield* Effect.serviceOption(SqlClient.SqlClient);
	const reactivity = yield* Effect.serviceOption(Reactivity.Reactivity);
	if (Option.isNone(sql) || Option.isNone(reactivity)) {
		return;
	}
	yield* invalidateOnCommit(invalidationKeys(keys)).pipe(
		transact(),
		Effect.catch((error) => Effect.logError("Better Auth change announcement failed; open screens stay stale until they resync", error)),
		Effect.provideService(SqlClient.SqlClient, sql.value),
		Effect.provideService(Reactivity.Reactivity, reactivity.value),
	);
});

type Row = { readonly id: string } | null;

// Better Auth hands an update's after hook null when the update matched no row, as when a refreshing session was deleted meanwhile.
function announceRow(row: Row, keys: (id: string) => readonly Key[]) {
	return row === null ? Effect.void : announce(keys(row.id));
}

function userCreated(user: Row) {
	return announceRow(user, (id) => [userKeys.item(id)]);
}

function userChanged(user: Row) {
	return announceRow(user, (id) => [userKeys.item(id), sessionKeys.list]);
}

function sessionChanged(session: Row) {
	return announceRow(session, (id) => [sessionKeys.item(id)]);
}

export const changeHooks: BetterAuthDatabaseHooks = {
	session: { create: { after: sessionChanged }, delete: { after: sessionChanged }, update: { after: sessionChanged } },
	user: { create: { after: userCreated }, delete: { after: userChanged }, update: { after: userChanged } },
};
