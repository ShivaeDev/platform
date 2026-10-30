import { DateTime, Effect, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import type { AccessPolicy } from "@shivaedev/access/roleSet.ts";
import { AuthUnavailable, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { requirePermission } from "@shivaedev/identity/permission.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { AssignRoles, ReadUsers } from "#permissions.ts";
import { AppUser, type ChangeRoleInput, LastRoleAssigner, type UserListInput } from "#users/roles.ts";

function unavailable() {
	return new AuthUnavailable({ message: "Could not access app users" });
}

export const listUsers = Effect.fn("Admin.listUsers")(function* <TRole extends string>(
	access: Pick<AccessPolicy<TRole>, "Role">,
	input: typeof UserListInput.Type,
) {
	yield* requirePermission(ReadUsers);
	const sql = yield* SqlClient.SqlClient;
	const read = SqlSchema.findAll({
		execute: () => sql`select id, name, email, role, "createdAt" from "user"
			where id > ${input.cursor ?? ""} order by id limit ${input.limit + 1}`,
		Request: Schema.Void,
		Result: Schema.Struct({ ...AppUser.fields, role: access.Role }),
	});
	const rows = yield* read(undefined).pipe(Effect.mapError(unavailable));
	const users = rows.slice(0, input.limit);
	return { next: rows.length > input.limit ? Option.fromUndefinedOr(users.at(-1)?.id) : Option.none<string>(), users };
});

export const changeUserRole = Effect.fn("Admin.changeUserRole")(function* <TRole extends string>(
	access: Pick<AccessPolicy<TRole>, "Role" | "hasPermission">,
	input: ChangeRoleInput<TRole>,
) {
	const actor = yield* SessionUser;
	yield* requirePermission(AssignRoles);
	const sql = yield* SqlClient.SqlClient;
	const changed = yield* Effect.gen(function* () {
		yield* sql`select pg_advisory_xact_lock(hashtext('platform.auth.user-roles'))`;
		const readTarget = SqlSchema.findOneOption({
			execute: (id) => sql`select id, role from "user" where id = ${id} for update`,
			Request: AppUser.fields.id,
			Result: Schema.Struct({ id: AppUser.fields.id, role: Schema.NullOr(AppUser.fields.role) }),
		});
		const target = yield* readTarget(input.userId).pipe(Effect.mapError(unavailable));
		if (Option.isNone(target)) {
			return yield* Effect.fail(new NotFound({ message: "User not found" }));
		}
		const next = yield* Schema.decodeUnknownEffect(access.Role)(input.role).pipe(Effect.mapError(unavailable));
		if (target.value.role === next) {
			return false;
		}
		const assigners = access.Role.literals.filter((role) => access.hasPermission(role, AssignRoles));
		if (assigners.some((role) => role === target.value.role) && !access.hasPermission(next, AssignRoles)) {
			const readHolders = SqlSchema.findAll({
				execute: () => sql`select id from "user" where role in ${sql.in(assigners)}`,
				Request: Schema.Void,
				Result: Schema.Struct({ id: AppUser.fields.id }),
			});
			const holders = yield* readHolders(undefined).pipe(Effect.mapError(unavailable));
			if (holders.length === 1) {
				return yield* Effect.fail(new LastRoleAssigner({ userId: input.userId }));
			}
		}
		yield* sql`update "user" set role = ${next}, "updatedAt" = now() where id = ${input.userId}`;
		yield* invalidateOnCommit(["admin.users"]);
		return true;
	}).pipe(transact({ onSqlError: unavailable }));
	if (changed) {
		const changedAt = DateTime.formatIso(yield* DateTime.now);
		yield* Effect.logInfo("User role changed").pipe(Effect.annotateLogs({ actorId: actor.id, changedAt, ...input }));
	}
});
