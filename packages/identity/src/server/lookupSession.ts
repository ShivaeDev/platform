import { Effect, Option } from "effect";
import type { Headers } from "effect/http";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";
import { transportOriginRequest } from "#server/origin.ts";
import { resolveRole } from "#server/resolveRole.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import type { SessionShape } from "#server/session.ts";

export const sessionRequest = Effect.fnUntraced(function* (headers: Headers.Headers, rpc: string) {
	const policy = yield* SessionPolicy;
	const request = yield* transportOriginRequest(headers, rpc);
	if (!policy.origin(request)) {
		const refused = Option.match(request.origin, { onNone: () => "a request without an Origin header", onSome: (origin) => `origin ${origin}` });
		yield* Effect.logWarning(
			`The session policy refused ${refused} calling ${rpc}. Add the origin to the policy's trusted origins if the application is served from it.`,
		);
		return yield* new Forbidden({ message: "Open this application from its own address to continue." });
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
