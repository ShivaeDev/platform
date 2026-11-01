import { Effect, Option } from "effect";
import type { Headers } from "effect/http";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { transportOriginRequest } from "./origin.ts";
import { resolveRole } from "./resolveRole.ts";
import { SessionPolicy } from "./SessionPolicy.ts";
import type { SessionShape } from "./session.ts";

export const sessionRequest = Effect.fnUntraced(function* (headers: Headers.Headers, rpc: string) {
	const policy = yield* SessionPolicy;
	const request = yield* transportOriginRequest(headers, rpc);
	if (!policy.origin(request)) {
		return yield* new Forbidden({ message: "Origin not allowed" });
	}
	return request;
});

export const sessionAccess = Effect.fnUntraced(function* <TSession extends SessionShape>(session: Option.Option<TSession>) {
	const policy = yield* SessionPolicy;
	if (Option.isNone(session) || policy.roles === undefined) {
		return session;
	}
	const role: unknown = Reflect.get(session.value.user, "role");
	const access = yield* resolveRole(policy.roles, role);
	return Option.some({ ...session.value, user: { ...session.value.user, ...access } });
});

export const lookupSession = Effect.fnUntraced(function* (headers: Headers.Headers) {
	const policy = yield* SessionPolicy;
	return yield* sessionAccess(yield* policy.provider.get(headers));
});
