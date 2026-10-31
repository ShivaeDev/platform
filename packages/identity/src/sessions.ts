import { Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { AuthUnavailable, Forbidden, NotFound } from "@shivaedev/errors/taxonomy.ts";
import { SessionsPermission } from "#sessionPermissions.ts";

const sessions = collection("identity.sessions", Schema.String);

export const SignedInSession = Schema.Struct({
	expiresAt: Schema.DateTimeUtcFromDate,
	id: Schema.String,
	lastActivityAt: Schema.DateTimeUtcFromDate,
	startedAt: Schema.DateTimeUtcFromDate,
	user: Schema.Struct({ email: Schema.String, id: Schema.String, name: Schema.String }),
});

export const SessionCursor = Schema.Struct({ id: Schema.String, lastActivityAt: Schema.DateTimeUtcFromString });
export const SessionListInput = Schema.Struct({
	cursor: Schema.optionalKey(SessionCursor),
	limit: Schema.Number.check(Schema.isInt(), Schema.isBetween({ maximum: 100, minimum: 1 })),
});
export const SessionList = Schema.Struct({ next: Schema.OptionFromNullOr(SessionCursor), sessions: Schema.Array(SignedInSession) });

export const Sessions = contract("identity.sessions", {
	commands: [
		command("revoke", {
			invalidates: () => [sessions.list],
			payload: { id: Schema.String },
			rejections: { AuthUnavailable, Forbidden, NotFound },
		}),
	],
	queries: [
		query("list", {
			payload: SessionListInput.fields,
			readPolicy: () => Effect.succeed(true),
			reads: () => [sessions.list],
			rejections: { AuthUnavailable, Forbidden },
			success: SessionList,
		}),
	],
}).middleware(SessionsPermission);
