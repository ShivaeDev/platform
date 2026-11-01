import { DateTime, Effect, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { requirePermission } from "@shivaedev/access/requirePermission.ts";
import type { AccessPolicy } from "@shivaedev/access/roleSet.ts";
import { AssignRoles } from "@shivaedev/access/roles.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { assignRole } from "@shivaedev/identity/server/better-auth/assignRole.ts";
import { type AuthTableOptions, tables } from "@shivaedev/identity/server/better-auth/tables.ts";
import { ReadUsers } from "#permissions.ts";
import { AppUser, type ChangeRoleInput, type UserListInput } from "#users/roles.ts";

function unavailable() {
	return new AuthUnavailable({ message: "Could not access app users" });
}

export const listUsers = Effect.fn("Admin.listUsers")(function* <TRole extends string>(
	access: Pick<AccessPolicy<TRole>, "Role">,
	input: typeof UserListInput.Type,
	options?: AuthTableOptions,
) {
	yield* requirePermission(yield* SessionUser, ReadUsers);
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	const { user } = tables(options);
	const read = SqlSchema.findAll({
		execute: () => sql`select id, ${sql(user.name)} as name, ${sql(user.email)} as email,
			${sql(user.role)} as role, ${sql(user.createdAt)} as "createdAt" from ${sql(user.table)}
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
	options?: AuthTableOptions,
) {
	const actor = yield* SessionUser;
	yield* requirePermission(actor, AssignRoles);
	const changed = yield* assignRole(access, input.userId, input.role, options);
	if (changed) {
		const changedAt = DateTime.formatIso(yield* DateTime.now);
		yield* Effect.logInfo("User role changed").pipe(Effect.annotateLogs({ actorId: actor.id, changedAt, ...input }));
	}
});
