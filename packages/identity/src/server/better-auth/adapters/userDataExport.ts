import type { BetterAuthOptions } from "better-auth";
import { getAuthTables } from "better-auth/db";
import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

const Timestamps = { createdAt: Schema.DateTimeUtcFromDate, updatedAt: Schema.DateTimeUtcFromDate };
const User = Schema.Struct({
	...Timestamps,
	email: Schema.String,
	emailVerified: Schema.Boolean,
	id: Schema.String,
	image: Schema.NullOr(Schema.String),
	name: Schema.String,
});
const Account = Schema.Struct({ ...Timestamps, accountId: Schema.String, id: Schema.String, providerId: Schema.String, userId: Schema.String });
const Session = Schema.Struct({
	...Timestamps,
	expiresAt: Schema.DateTimeUtcFromDate,
	id: Schema.String,
	ipAddress: Schema.NullOr(Schema.String),
	userAgent: Schema.NullOr(Schema.String),
	userId: Schema.String,
});

export function betterAuthUserDataExport(options: BetterAuthOptions = {}, schema = "public") {
	const models = getAuthTables(options);
	return {
		export: Effect.fn("BetterAuth.export")(function* (userId: string) {
			const sql = (yield* SqlClient.SqlClient).withoutTransforms();
			function select(model: string, fields: readonly string[], owner: string, id: string) {
				const table = models[model];
				function column(name: string) {
					return table?.fields[name]?.fieldName ?? name;
				}
				const columns = sql.csv(fields.map((name) => sql`${sql(column(name))} as ${sql(name)}`));
				return sql`select ${columns} from ${sql(`${schema}.${table?.modelName ?? model}`)} where ${sql(column(owner))} = ${id} order by id`;
			}
			const users = yield* SqlSchema.findAll({
				execute: (id) => select("user", Object.keys(User.fields), "id", id),
				Request: Schema.String,
				Result: User,
			})(userId);
			const accounts = yield* SqlSchema.findAll({
				execute: (id) => select("account", Object.keys(Account.fields), "userId", id),
				Request: Schema.String,
				Result: Account,
			})(userId);
			const sessions = yield* SqlSchema.findAll({
				execute: (id) => select("session", Object.keys(Session.fields), "userId", id),
				Request: Schema.String,
				Result: Session,
			})(userId);
			return { accounts, sessions, users };
		}),
		tables: ["user", "account", "session"].map((model) => ({ schema, table: models[model]?.modelName ?? model })),
	};
}
