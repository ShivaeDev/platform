import { DateTime, Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

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
		omitImageColumn: sql`alter table "user" drop column image`.pipe(Effect.asVoid),
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
		users: sql<{ email: string; id: string }>`select id, email from "user" order by email`,
	};
});
