import { expect } from "vitest";
import { AuthUnavailable, Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { forbiddenOrigin, profile, providerOutage, sessionUser } from "#test/rpc/profile.ts";

const user = { email: "alice@example.test", id: "alice", name: "Alice", privateField: "provider-only" };
profile.it("provides only the profile fields and keeps Identity limited to id", [sessionUser(user)], function* ({ whoami }) {
	const result = yield* whoami();
	expect(result._tag === "Success" && result.success).toEqual({
		identity: { id: user.id },
		identityKeys: ["id"],
		profileKeys: ["email", "id", "name"],
		user: { email: user.email, id: user.id, name: user.name },
	});
});
profile.it("forbids the origin before consulting the session provider", [forbiddenOrigin, providerOutage], function* ({ whoami, sessionRequests }) {
	const forbidden = yield* whoami();
	expect(forbidden._tag === "Failure" && forbidden.failure).toBeInstanceOf(Forbidden);
	expect(sessionRequests()).toEqual([]);
});
profile.it("rejects a missing session as unauthorized", [], function* ({ whoami, sessionRequests }) {
	const anonymous = yield* whoami();
	expect(anonymous._tag === "Failure" && anonymous.failure).toBeInstanceOf(Unauthorized);
	expect(sessionRequests()).toEqual(["Whoami"]);
});
profile.it("reports a provider failure as unavailable", [providerOutage], function* ({ whoami, sessionRequests }) {
	const unavailable = yield* whoami();
	expect(unavailable._tag === "Failure" && unavailable.failure).toBeInstanceOf(AuthUnavailable);
	expect(sessionRequests()).toEqual(["Whoami"]);
});
