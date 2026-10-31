import { DateTime, Effect, Option, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";
import { requirePermission } from "@shivaedev/access/requirePermission.ts";
import { AuthUnavailable, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { SessionUser } from "#identity.ts";
import { ManageSessions } from "#sessionPermissions.ts";
import { type SessionListInput, SignedInSession } from "#sessions.ts";

function unavailable() {
	return new AuthUnavailable({ message: "Could not access signed-in sessions" });
}

export const listSessions = Effect.fn("Identity.listSessions")(function* (input: typeof SessionListInput.Type) {
	yield* requirePermission(yield* SessionUser, ManageSessions);
	const sql = yield* SqlClient.SqlClient;
	const now = DateTime.toDateUtc(yield* DateTime.now);
	const cursor = input.cursor;
	const before = cursor === undefined ? sql`true` : sql`(s."updatedAt", s.id) < (${DateTime.toDateUtc(cursor.lastActivityAt)}, ${cursor.id})`;
	const read = SqlSchema.findAll({
		execute: () => sql`select s.id, s."createdAt" as "startedAt", s."updatedAt" as "lastActivityAt", s."expiresAt",
			json_build_object('id', u.id, 'name', u.name, 'email', u.email) as "user"
			from "session" s join "user" u on u.id = s."userId"
			where s."expiresAt" > ${now} and ${before}
			order by s."updatedAt" desc, s.id desc limit ${input.limit + 1}`,
		Request: Schema.Void,
		Result: SignedInSession,
	});
	const rows = yield* read(undefined).pipe(Effect.mapError(unavailable));
	const sessions = rows.slice(0, input.limit);
	const next = Option.fromUndefinedOr(sessions.at(-1)).pipe(
		Option.filter(() => rows.length > input.limit),
		Option.map(({ id, lastActivityAt }) => ({ id, lastActivityAt })),
	);
	return { next, sessions };
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
