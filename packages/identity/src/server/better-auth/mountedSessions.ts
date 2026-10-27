import { Schema } from "effect";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { betterAuthSessions, type GetSession } from "#server/adapters/betterAuthSessions.ts";
import type { SessionShape } from "#server/session.ts";

const AuthSession = Schema.NullOr(
	Schema.Struct({
		user: Schema.Struct({ email: Schema.String, id: Schema.String, name: Schema.String, role: Schema.optionalKey(Schema.NullOr(Schema.String)) }),
	}),
);

export function mountedSessions(
	lookup: (headers: Headers) => Promise<unknown>,
	admit: <TSession extends SessionShape>(getSession: GetSession<TSession>) => GetSession<TSession>,
	roles?: RoleSet,
) {
	return {
		...(roles === undefined ? {} : { roles }),
		provider: betterAuthSessions(admit(async (headers) => Schema.decodeUnknownSync(AuthSession)(await lookup(headers)))),
	};
}
