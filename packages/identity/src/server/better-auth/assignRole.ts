import { Effect, Option, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient, SqlSchema } from "effect/sql";
import type { AccessPolicy } from "@shivaedev/access/roleSet.ts";
import { AssignRoles, LastRoleAssigner } from "@shivaedev/access/roles.ts";
import { AuthUnavailable, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";

function unavailable() {
	return new AuthUnavailable({ message: "Could not access app users" });
}

export const assignRole = Effect.fn("Identity.assignRole")(function* <TRole extends string>(
	access: Pick<AccessPolicy<TRole>, "Role" | "hasPermission">,
	userId: string,
	role: NoInfer<TRole>,
) {
	const sql = yield* SqlClient.SqlClient;
	const existing = yield* Effect.serviceOption(Reactivity.Reactivity);
	const reactivity = Option.isSome(existing) ? existing.value : yield* Reactivity.make;
	return yield* Effect.gen(function* () {
		yield* sql`select pg_advisory_xact_lock(hashtext('platform.auth.user-roles'))`;
		const readTarget = SqlSchema.findOneOption({
			execute: (id) => sql`select id, role from "user" where id = ${id} for update`,
			Request: Schema.String,
			Result: Schema.Struct({ id: Schema.String, role: Schema.NullOr(Schema.String) }),
		});
		const target = yield* readTarget(userId).pipe(Effect.mapError(unavailable));
		if (Option.isNone(target)) {
			return yield* Effect.fail(new NotFound({ message: "User not found" }));
		}
		if (target.value.role === role) {
			return false;
		}
		const assigners = access.Role.literals.filter((candidate) => access.hasPermission(candidate, AssignRoles));
		if (assigners.some((candidate) => candidate === target.value.role) && !access.hasPermission(role, AssignRoles)) {
			const readHolders = SqlSchema.findAll({
				execute: () => sql`select id from "user" where role in ${sql.in(assigners)}`,
				Request: Schema.Void,
				Result: Schema.Struct({ id: Schema.String }),
			});
			const holders = yield* readHolders(undefined).pipe(Effect.mapError(unavailable));
			if (holders.length === 1) {
				return yield* Effect.fail(new LastRoleAssigner({ userId }));
			}
		}
		yield* sql`update "user" set role = ${role}, "updatedAt" = now() where id = ${userId}`;
		yield* invalidateOnCommit(["admin.users"]);
		return true;
	}).pipe(transact({ onSqlError: unavailable }), Effect.provideService(Reactivity.Reactivity, reactivity));
});
