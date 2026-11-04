import { Effect, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import type { AccessPolicy } from "@shivaedev/access/roleSet.ts";
import { AuthUnavailable, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { keysetPage } from "@shivaedev/sql/keysetPage.ts";
import { type AuthTableOptions, tables } from "#server/better-auth/adapters/tables.ts";
import { AccountName, DirectoryUser, UserListInput } from "#users.ts";

function unavailable() {
	return new AuthUnavailable({ message: "Could not access app users" });
}

export const userDirectoryReads = Effect.fnUntraced(function* <TRole extends string>(
	access: Pick<AccessPolicy<TRole>, "Role">,
	options?: AuthTableOptions,
) {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	const { user } = tables(options);
	const User = Schema.Struct({ ...DirectoryUser.fields, role: access.Role });
	const readRole = SqlSchema.findOneOption({
		execute: (id) => sql`select ${sql(user.role)} as role from ${sql(user.table)} where id = ${id}`,
		Request: Schema.String,
		Result: Schema.Struct({ role: access.Role }),
	});
	const readNames = SqlSchema.findAll({
		execute: (ids) => sql`select id, ${sql(user.name)} as name from ${sql(user.table)} where id in ${sql.in(ids)} order by id`,
		Request: Schema.Array(Schema.String),
		Result: AccountName,
	});
	return {
		list: Effect.fn("UserDirectory.list")(function* (input: typeof UserListInput.Type) {
			const request = yield* Schema.decodeUnknownEffect(UserListInput)(input).pipe(Effect.mapError(unavailable));
			const page = yield* keysetPage({
				after: request.cursor ?? "",
				cursorFor: (row: typeof User.Type) => row.id,
				limit: request.limit,
				orderBy: [],
				read: ({ limit, orderBy, seek }) =>
					SqlSchema.findAll({
						execute: () => sql`select id, ${sql(user.name)} as name, ${sql(user.email)} as email,
							${sql(user.role)} as role, ${sql(user.createdAt)} as "createdAt" from ${sql(user.table)}
							where ${seek} order by ${orderBy} limit ${limit}`,
						Request: Schema.Void,
						Result: User,
					})(undefined),
				tieBreaker: { column: "id", direction: "asc", value: (cursor: string) => cursor },
			}).pipe(Effect.mapError(unavailable));
			return { next: page.next, users: page.rows };
		}),
		names: (ids: readonly string[]) => (ids.length === 0 ? Effect.succeed([]) : readNames(ids).pipe(Effect.mapError(unavailable))),
		role: Effect.fn("UserDirectory.role")(function* (id: string) {
			const found = yield* readRole(id).pipe(Effect.mapError(unavailable));
			return Option.isSome(found) ? found.value.role : yield* new NotFound({ message: "User not found" });
		}),
	};
});
