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
const announce = Effect.fnUntraced(function* (keys: readonly Key[]) {
	const sql = yield* Effect.serviceOption(SqlClient.SqlClient);
	const reactivity = yield* Effect.serviceOption(Reactivity.Reactivity);
	if (Option.isNone(sql) || Option.isNone(reactivity)) {
		return;
	}
	yield* invalidateOnCommit(invalidationKeys(keys)).pipe(
		transact(),
		Effect.catch((error) => Effect.logError("Better Auth change announcement failed; open screens stay stale until they resync", error)),
	);
});

function userCreated({ id }: { readonly id: string }) {
	return announce([userKeys.item(id)]);
}

// The sessions list shows each session's user name and email, and loses the sessions of a deleted user.
function userChanged({ id }: { readonly id: string }) {
	return announce([userKeys.item(id), sessionKeys.list]);
}

function sessionChanged({ id }: { readonly id: string }) {
	return announce([sessionKeys.item(id)]);
}

export const changeHooks: BetterAuthDatabaseHooks = {
	session: { create: { after: sessionChanged }, delete: { after: sessionChanged }, update: { after: sessionChanged } },
	user: { create: { after: userCreated }, delete: { after: userChanged }, update: { after: userChanged } },
};
