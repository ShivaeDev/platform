import { Effect, Option } from "effect";
import type { Headers } from "effect/http";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { transportOriginRequest } from "./origin.ts";
import { resolveRole } from "./resolveRole.ts";
import type { SessionPolicy, SessionShape } from "./session.ts";

export const sessionRequest = Effect.fnUntraced(function* (policy: SessionPolicy<SessionShape>, headers: Headers.Headers, rpc: string) {
	const request = yield* transportOriginRequest(headers, rpc);
	if (!policy.origin(request)) {
		return yield* new Forbidden({ message: "Origin not allowed" });
	}
	return request;
});

export const sessionAccess = Effect.fnUntraced(function* <TSession extends SessionShape>(
	policy: SessionPolicy<SessionShape>,
	session: Option.Option<TSession>,
) {
	if (Option.isNone(session) || policy.roles === undefined) {
		return session;
	}
	const role: unknown = Reflect.get(session.value.user, "role");
	const access = yield* resolveRole(policy.roles, role);
	return Option.some({ ...session.value, user: { ...session.value.user, ...access } });
});

export const lookupSession = Effect.fnUntraced(function* <TSession extends SessionShape>(policy: SessionPolicy<TSession>, headers: Headers.Headers) {
	return yield* sessionAccess(policy, yield* policy.provider.get(headers));
});
