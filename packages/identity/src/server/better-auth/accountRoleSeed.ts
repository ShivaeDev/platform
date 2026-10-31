import { type Config, Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import type { AccessPolicy } from "@shivaedev/access/roleSet.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { ProviderAccountValue } from "#identity.ts";
import { assignRole } from "./assignRole.ts";

export interface AccountRoleSeed<E> {
	readonly onSignIn: (userId: string) => Effect.Effect<void, E>;
}

export const accountRoleSeed = Effect.fn("Identity.accountRoleSeed")(function* <TRole extends string>(
	access: Pick<AccessPolicy<TRole>, "Role" | "hasPermission">,
	role: NoInfer<TRole>,
	accounts: Config.Config<readonly ProviderAccountValue[]>,
) {
	const listed = yield* accounts;
	const context = yield* Effect.context<SqlClient.SqlClient>();
	const sql = yield* SqlClient.SqlClient;
	const findUsers = SqlSchema.findAll({
		execute: ({ accountId, providerId, userId }) => sql`
			select distinct "userId" as id from "account"
			where "providerId" = ${providerId} and "accountId" = ${accountId}
			${userId === undefined ? sql.literal("") : sql`and "userId" = ${userId}`}`,
		Request: Schema.Struct({ accountId: Schema.String, providerId: Schema.String, userId: Schema.optional(Schema.String) }),
		Result: Schema.Struct({ id: Schema.String }),
	});
	const apply = Effect.fnUntraced(function* (userId?: string) {
		for (const account of listed) {
			const users = yield* findUsers({ ...account, userId }).pipe(
				Effect.mapError(() => new AuthUnavailable({ message: "Could not access provider accounts" })),
			);
			for (const user of users) {
				yield* assignRole(access, user.id, role);
			}
		}
	});
	yield* apply();
	return { onSignIn: (userId: string) => apply(userId).pipe(Effect.provideContext(context)) };
});
