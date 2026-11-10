import { DateTime, Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { migrateBetterAuth } from "#server/better-auth/migrate.ts";

const StoredSession = Schema.Struct({ expiresAt: Schema.DateTimeUtcFromDate, id: Schema.String });
const RoleColumn = Schema.Struct({ default: Schema.NullOr(Schema.String), nullable: Schema.String, type: Schema.String });
const SessionIpAddress = Schema.Struct({ ipAddress: Schema.NullOr(Schema.String) });
const SessionOwner = Schema.Struct({ email: Schema.String, id: Schema.String, userId: Schema.String });
const UserRole = Schema.Struct({ email: Schema.String, role: Schema.NullOr(Schema.String) });
const UserAccount = Schema.Struct({ email: Schema.String, id: Schema.String });

function decodedRows<TRow extends Schema.Constraint, E>(Result: TRow, statement: Effect.Effect<readonly unknown[], E>) {
	return SqlSchema.findAll({ execute: () => statement, Request: Schema.Void, Result })(undefined);
}

export const authTestDatabase = Effect.gen(function* () {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	const readSessions = SqlSchema.findAll({
		execute: (userId) => sql`select id, "expiresAt" from "session" where "userId" = ${userId} order by id`,
		Request: Schema.String,
		Result: StoredSession,
	});
	return {
		expireSessions: (userId?: string) =>
			Effect.gen(function* () {
				const expiredAt = DateTime.toDateUtc(DateTime.subtract(yield* DateTime.now, { seconds: 1 }));
				yield* sql`update "session" set "expiresAt" = ${expiredAt} ${userId === undefined ? sql.literal("") : sql`where "userId" = ${userId}`}`;
			}),
		migrate: migrateBetterAuth,
		omitImageColumn: sql`alter table "user" drop column image`.pipe(Effect.asVoid),
		omitRole: (userId: string) =>
			Effect.gen(function* () {
				yield* sql`alter table "user" alter column role drop not null`;
				yield* sql`update "user" set role = null where id = ${userId}`;
			}),
		roleColumn: decodedRows(
			RoleColumn,
			sql`
			select data_type as type, is_nullable as nullable, column_default as "default"
			from information_schema.columns where table_schema = current_schema() and table_name = 'user' and column_name = 'role'`,
		),
		sessionIpAddresses: decodedRows(SessionIpAddress, sql`select "ipAddress" from "session" order by "createdAt", id`),
		sessions: decodedRows(
			SessionOwner,
			sql`select s.id, s."userId", u.email from "session" s join "user" u on u.id = s."userId" order by u.email, s.id`,
		),
		sessionsFor: Effect.fnUntraced(function* (userId: string) {
			const sessions = yield* readSessions(userId);
			const now = yield* DateTime.now;
			return sessions.map((session) => ({ ...session, expired: DateTime.toEpochMillis(session.expiresAt) <= DateTime.toEpochMillis(now) }));
		}),
		userRoles: decodedRows(UserRole, sql`select email, role from "user" order by email`),
		users: decodedRows(UserAccount, sql`select id, email from "user" order by email`),
	};
});
