import { Effect, Schema } from "effect";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { resolveRole } from "#server/resolveRole.ts";

const Fields = Schema.Record(Schema.String, Schema.Unknown);
const SessionPayload = Schema.NullOr(Schema.StructWithRest(Schema.Struct({ user: Fields }), [Fields]));

export async function sessionPermissions(response: Response, roles: RoleSet): Promise<Response> {
	const payload = Schema.decodeUnknownSync(SessionPayload)(await response.json());
	if (payload === null) {
		return Response.json(null, response);
	}
	const access = await Effect.runPromise(resolveRole(roles, payload.user.role));
	const headers = new Headers(response.headers);
	headers.delete("content-length");
	headers.set("cache-control", "private, no-store");
	return Response.json({ ...payload, user: { ...payload.user, ...access } }, { headers, status: response.status });
}
