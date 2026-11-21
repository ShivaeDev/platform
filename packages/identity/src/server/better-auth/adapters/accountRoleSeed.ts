import { type Config, Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { ProviderAccountValue } from "#identity.ts";
import { assignRole } from "#server/better-auth/assignRole.ts";
import type { RoleTables } from "#server/better-auth/define.ts";
import { tables } from "#server/better-auth/tables.ts";

export interface AccountRoleSeed<E> {
	readonly onSignIn: (userId: string) => Effect.Effect<void, E>;
}

export const accountRoleSeed = Effect.fn("Identity.accountRoleSeed")(function* <TRole extends string>(
	auth: RoleTables<TRole>,
	role: NoInfer<TRole>,
	accounts: Config.Config<readonly ProviderAccountValue[]>,
) {
	const listed = yield* accounts;
	const context = yield* Effect.context<SqlClient.SqlClient>();
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	const { account: accountTable } = tables(auth.options);
	const findUsers = SqlSchema.findAll({
		execute: ({ accountId, providerId, userId }) => sql`
			select distinct ${sql(accountTable.userId)} as id from ${sql(accountTable.table)}
			where ${sql(accountTable.providerId)} = ${providerId} and ${sql(accountTable.accountId)} = ${accountId}
			${userId === undefined ? sql.literal("") : sql`and ${sql(accountTable.userId)} = ${userId}`}`,
		Request: Schema.Struct({ accountId: Schema.String, providerId: Schema.String, userId: Schema.optional(Schema.String) }),
		Result: Schema.Struct({ id: Schema.String }),
	});
	const apply = Effect.fnUntraced(function* (userId?: string) {
		for (const account of listed) {
			const users = yield* findUsers({ ...account, userId }).pipe(
				Effect.mapError(() => new AuthUnavailable({ message: "Could not access provider accounts" })),
			);
			for (const user of users) {
				yield* assignRole(auth, user.id, role);
			}
		}
	});
	yield* apply();
	return { onSignIn: (userId: string) => apply(userId).pipe(Effect.provideContext(context)) };
});
