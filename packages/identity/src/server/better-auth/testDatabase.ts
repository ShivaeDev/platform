import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export const authTestDatabase = Effect.gen(function* () {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
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
		users: sql<{ email: string; id: string }>`select id, email from "user" order by email`,
	};
});
