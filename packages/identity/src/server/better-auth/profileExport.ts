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

// Selects each field it exports, so passwords and provider or session tokens stay out of a person's export.
export function profileExport(options: Omit<BetterAuthOptions, "database">, schema: string) {
	const models = getAuthTables(options);
	return Effect.fn("BetterAuth.profileExport")(function* (userId: string) {
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
	});
}
