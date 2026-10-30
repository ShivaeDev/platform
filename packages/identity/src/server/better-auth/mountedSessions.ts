import { Schema } from "effect";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { SessionUserSchema } from "#identity.ts";
import type { GetSession } from "#server/adapters/betterAuthSessions.ts";
import type { SessionProvider, SessionShape } from "#server/session.ts";

const AuthSession = Schema.NullOr(Schema.Struct({ user: SessionUserSchema }));
type SessionLookup = (options: {
	readonly asResponse: false;
	readonly headers: Headers;
	readonly query: { readonly disableCookieCache: true };
	readonly returnHeaders: false;
}) => Promise<unknown>;
const SessionLookup = Schema.declare((value): value is SessionLookup => typeof value === "function");

export function mountedSessions(
	lookup: unknown,
	admit: <TSession extends SessionShape>(getSession: GetSession<TSession>) => SessionProvider<TSession>,
	roles?: RoleSet,
) {
	const getSession = Schema.decodeUnknownSync(SessionLookup)(lookup);
	return {
		...(roles === undefined ? {} : { roles }),
		provider: admit(async (headers) =>
			Schema.decodeUnknownSync(AuthSession)(
				await getSession({ asResponse: false, headers, query: { disableCookieCache: true }, returnHeaders: false }),
			),
		),
	};
}
