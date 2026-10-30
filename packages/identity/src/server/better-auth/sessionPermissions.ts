import { type Cause, Effect, Schema } from "effect";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { SessionUserSchema } from "#identity.ts";
import { resolveRole } from "#server/resolveRole.ts";

const Fields = Schema.Record(Schema.String, Schema.Unknown);
const SessionPayload = Schema.NullOr(Schema.StructWithRest(Schema.Struct({ user: Schema.StructWithRest(SessionUserSchema, [Fields]) }), [Fields]));

export const sessionPermissions = Effect.fn("Platform.sessionPermissions")(function* (
	response: Response,
	roles: RoleSet,
): Effect.fn.Return<Response, Cause.UnknownError | Schema.SchemaError> {
	const payload = yield* Schema.decodeUnknownEffect(SessionPayload)(yield* Effect.tryPromise(() => response.json()));
	if (payload === null) {
		return Response.json(null, response);
	}
	const access = yield* resolveRole(roles, payload.user.role);
	const headers = new Headers(response.headers);
	headers.delete("content-length");
	headers.set("cache-control", "private, no-store");
	return Response.json({ ...payload, user: { ...payload.user, ...access } }, { headers, status: response.status });
});
