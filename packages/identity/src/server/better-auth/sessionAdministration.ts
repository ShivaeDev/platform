import { DateTime, Effect, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { requirePermission } from "@shivaedev/access/requirePermission.ts";
import { AuthUnavailable, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { keysetPage } from "@shivaedev/sql/keysetPage.ts";
import { SessionUser } from "#identity.ts";
import { ManageSessions } from "#sessionPermissions.ts";
import { type SessionList, type SessionListInput, SignedInSession } from "#signedInSessions.ts";

function unavailable() {
	return new AuthUnavailable({ message: "Could not access signed-in sessions" });
}

export const listSessions = Effect.fn("Identity.listSessions")(function* (input: typeof SessionListInput.Type) {
	yield* requirePermission(yield* SessionUser, ManageSessions);
	const sql = yield* SqlClient.SqlClient;
	const now = DateTime.toDateUtc(yield* DateTime.now);
	const page = yield* keysetPage({
		after: input.cursor,
		cursorFor: ({ id, lastActivityAt }: typeof SignedInSession.Type) => ({ id, lastActivityAt }),
		limit: input.limit,
		orderBy: [{ column: sql`s."updatedAt"`, direction: "desc", value: (cursor) => DateTime.formatIso(cursor.lastActivityAt) }],
		read: ({ limit, orderBy, seek }) =>
			SqlSchema.findAll({
				execute: () => sql`select s.id, s."createdAt" as "startedAt", s."updatedAt" as "lastActivityAt", s."expiresAt",
					json_build_object('id', u.id, 'name', u.name, 'email', u.email) as "user"
					from "session" s join "user" u on u.id = s."userId"
					where s."expiresAt" > ${now} and ${seek}
					order by ${orderBy} limit ${limit}`,
				Request: Schema.Void,
				Result: SignedInSession,
			})(undefined),
		tieBreaker: { column: sql`s.id`, direction: "desc", value: (cursor) => cursor.id },
	}).pipe(Effect.mapError(unavailable));
	const list: SessionList = { next: page.next, sessions: page.rows };
	return list;
});

export const revokeSession = Effect.fn("Identity.revokeSession")(function* (id: string) {
	yield* requirePermission(yield* SessionUser, ManageSessions);
	const sql = yield* SqlClient.SqlClient;
	const remove = SqlSchema.findOneOption({
		execute: (sessionId) => sql`delete from "session" where id = ${sessionId} returning id`,
		Request: Schema.String,
		Result: Schema.Struct({ id: Schema.String }),
	});
	const removed = yield* remove(id).pipe(Effect.mapError(unavailable));
	if (Option.isNone(removed)) {
		return yield* new NotFound({ message: "Session not found" });
	}
});
