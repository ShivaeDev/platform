import { DateTime, Effect, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";
import { AuthUnavailable, Forbidden, NotFound } from "#errors/taxonomy.ts";
import { hasRole } from "#rpc/hasRole.ts";
import { SessionUser } from "#rpc/identity.ts";
import { type ChangeRoleInput, LastOwner, type UserListInput } from "#rpc/userRoles.ts";

const StoredUser = Schema.Struct({
	createdAt: Schema.Date,
	email: Schema.String,
	id: Schema.String,
	name: Schema.String,
	role: Schema.NullOr(Schema.String),
});
function unavailable() {
	return new AuthUnavailable({ message: "Could not access app users" });
}

export const listUsers = Effect.fn("Platform.listUsers")(function* (input: typeof UserListInput.Type) {
	const sql = yield* SqlClient.SqlClient;
	const read = SqlSchema.findAll({
		execute: () => sql`select id, name, email, role, "createdAt" from "user"
			where id > ${input.cursor ?? ""} order by id limit ${input.limit + 1}`,
		Request: Schema.Void,
		Result: StoredUser,
	});
	const rows = yield* read(undefined).pipe(Effect.mapError(unavailable));
	const users = rows.slice(0, input.limit).map(({ role, createdAt, ...user }) => ({
		...user,
		createdAt: DateTime.makeUnsafe(createdAt),
		roles: role?.split(",").filter(Boolean) ?? [],
	}));
	return { next: rows.length > input.limit ? Option.fromUndefinedOr(users.at(-1)?.id) : Option.none<string>(), users };
});

export const changeUserRole = Effect.fn("Platform.changeUserRole")(function* (input: typeof ChangeRoleInput.Type) {
	const actor = yield* SessionUser;
	if (!hasRole(actor, "owner")) {
		return yield* Effect.fail(new Forbidden({ message: "Owner role required" }));
	}
	const sql = yield* SqlClient.SqlClient;
	const changed = yield* Effect.gen(function* () {
		yield* sql`select pg_advisory_xact_lock(hashtext('platform.auth.user-roles'))`;
		const rows = yield* sql<{ readonly id: string; readonly role: string | null }>`select id, role from "user" where id = ${input.userId} for update`;
		const target = rows[0];
		if (target === undefined) {
			return yield* Effect.fail(new NotFound({ message: "User not found" }));
		}
		const roles = target.role?.split(",").filter(Boolean) ?? [];
		if (input.grant === roles.includes(input.role)) {
			return false;
		}
		if (!input.grant && input.role === "owner") {
			const owners = yield* sql<{ readonly id: string }>`select id from "user" where 'owner' = any(string_to_array(role, ','))`;
			if (owners.length === 1) {
				return yield* Effect.fail(new LastOwner({ userId: input.userId }));
			}
		}
		const next = input.grant ? [...roles, input.role] : roles.filter((role) => role !== input.role);
		yield* sql`update "user" set role = ${next.join(",")}, "updatedAt" = now() where id = ${input.userId}`;
		yield* invalidateOnCommit(["admin.users"]);
		return true;
	}).pipe(transact({ onSqlError: unavailable }));
	if (changed) {
		const changedAt = DateTime.formatIso(yield* DateTime.now);
		yield* Effect.logInfo("User role changed").pipe(Effect.annotateLogs({ actorId: actor.id, changedAt, ...input }));
	}
});
