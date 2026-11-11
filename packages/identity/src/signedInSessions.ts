import { type Option, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";

export const sessionKeys = collection("identity.sessions", Schema.String);

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

export interface SessionList {
	readonly next: Option.Option<typeof SessionCursor.Type>;
	readonly sessions: readonly (typeof SignedInSession.Type)[];
}
