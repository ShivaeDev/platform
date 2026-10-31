import { DateTime, Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { migrateBetterAuth } from "./migrate.ts";

const StoredSession = Schema.Struct({ expiresAt: Schema.DateTimeUtcFromDate, id: Schema.String });

export const authTestDatabase = Effect.gen(function* () {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	const readSessions = SqlSchema.findAll({
		execute: (userId) => sql`select id, "expiresAt" from "session" where "userId" = ${userId} order by id`,
		Request: Schema.String,
		Result: StoredSession,
	});
	return {
		expireSessions: (userId?: string) =>
			sql`update "session" set "expiresAt" = now() - interval '1 second' ${userId === undefined ? sql.literal("") : sql`where "userId" = ${userId}`}`.pipe(
				Effect.asVoid,
			),
		migrate: migrateBetterAuth,
		omitImageColumn: sql`alter table "user" drop column image`.pipe(Effect.asVoid),
		omitRole: (userId: string) =>
			Effect.gen(function* () {
				yield* sql`alter table "user" alter column role drop not null`;
				yield* sql`update "user" set role = null where id = ${userId}`;
			}),
		roleColumn: sql<{ type: string; nullable: string; default: string | null }>`
			select data_type as type, is_nullable as nullable, column_default as "default"
			from information_schema.columns where table_schema = current_schema() and table_name = 'user' and column_name = 'role'`,
		sessionIpAddresses: sql<{ ipAddress: string | null }>`select "ipAddress" from "session" order by "createdAt", id`,
		sessions: sql<{
			email: string;
			id: string;
			userId: string;
		}>`select s.id, s."userId", u.email from "session" s join "user" u on u.id = s."userId" order by u.email, s.id`,
		sessionsFor: Effect.fnUntraced(function* (userId: string) {
			const sessions = yield* readSessions(userId);
			const now = yield* DateTime.now;
			return sessions.map((session) => ({ ...session, expired: DateTime.toEpochMillis(session.expiresAt) <= DateTime.toEpochMillis(now) }));
		}),
		userRoles: sql<{ email: string; role: string | null }>`select email, role from "user" order by email`,
		users: sql<{ email: string; id: string }>`select id, email from "user" order by email`,
	};
});
