import { expect } from "vitest";
import { AuthUnavailable, Forbidden, Unauthorized } from "#errors/taxonomy.ts";
import { profile } from "#test/rpc/profile.ts";

profile.it("provides only the profile fields and keeps Identity limited to id", [], function* ({ whoami }) {
	const user = { email: "alice@example.test", id: "alice", name: "Alice", privateField: "provider-only" };
	const result = yield* whoami(user);
	expect(result._tag === "Success" && result.success).toEqual({
		identity: { id: user.id },
		identityKeys: ["id"],
		profileKeys: ["email", "id", "name"],
		user: { email: user.email, id: user.id, name: user.name },
	});
});
profile.it("keeps missing sessions, forbidden origins and provider failures distinct", [], function* ({ whoami, lookups }) {
	const forbidden = yield* whoami(undefined, false);
	expect(forbidden._tag === "Failure" && forbidden.failure).toBeInstanceOf(Forbidden);
	expect(lookups()).toBe(0);
	const anonymous = yield* whoami();
	expect(anonymous._tag === "Failure" && anonymous.failure).toBeInstanceOf(Unauthorized);
	const unavailable = yield* whoami(undefined, true, true);
	expect(unavailable._tag === "Failure" && unavailable.failure).toBeInstanceOf(AuthUnavailable);
});
