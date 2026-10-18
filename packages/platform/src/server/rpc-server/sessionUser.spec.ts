import { APIError } from "better-auth/api";
import { expect } from "vitest";
import { AuthUnavailable, Forbidden, Unauthorized } from "#errors/taxonomy.ts";
import { betterAuthUser, forbiddenOrigin, profile, providerOutage, sessionUser } from "#test/rpc/profile.ts";

const user = { email: "alice@example.test", id: "alice", name: "Alice", privateField: "provider-only" };
const accounts = [{ accessToken: "secret", accountId: "123", id: "account-row", providerId: "github" }];
for (const cause of [new Error("Account storage unavailable"), new APIError("INTERNAL_SERVER_ERROR")]) {
	profile.it(
		`reports a provider account lookup ${cause.name} as unavailable`,
		[betterAuthUser(user, () => Promise.reject(cause))],
		function* ({ whoami }) {
			const result = yield* whoami();
			expect(result._tag === "Failure" && result.failure).toBeInstanceOf(AuthUnavailable);
		},
	);
}
for (const [name, trait] of [
	["custom", sessionUser({ ...user, providerAccounts: accounts })],
	["Better Auth", betterAuthUser(user, () => Promise.resolve(accounts))],
] as const) {
	profile.it(`provides only provider and account ids from a ${name} session provider`, [trait], function* ({ whoami }) {
		const result = yield* whoami();
		expect(result._tag === "Success" && result.success).toEqual({
			identity: { id: user.id },
			identityKeys: ["id"],
			profileKeys: ["email", "id", "name", "providerAccounts"],
			user: { email: user.email, id: user.id, name: user.name, providerAccounts: [{ accountId: "123", providerId: "github" }] },
		});
	});
}
profile.it("provides only the profile fields and keeps Identity limited to id", [sessionUser(user)], function* ({ whoami }) {
	const result = yield* whoami();
	expect(result._tag === "Success" && result.success).toEqual({
		identity: { id: user.id },
		identityKeys: ["id"],
		profileKeys: ["email", "id", "name"],
		user: { email: user.email, id: user.id, name: user.name },
	});
});
profile.it("forbids the origin before consulting the session provider", [forbiddenOrigin, providerOutage], function* ({ whoami, lookups }) {
	const forbidden = yield* whoami();
	expect(forbidden._tag === "Failure" && forbidden.failure).toBeInstanceOf(Forbidden);
	expect(lookups()).toBe(0);
});
profile.it("rejects a missing session as unauthorized", [], function* ({ whoami, lookups }) {
	const anonymous = yield* whoami();
	expect(anonymous._tag === "Failure" && anonymous.failure).toBeInstanceOf(Unauthorized);
	expect(lookups()).toBe(1);
});
profile.it("reports a provider failure as unavailable", [providerOutage], function* ({ whoami, lookups }) {
	const unavailable = yield* whoami();
	expect(unavailable._tag === "Failure" && unavailable.failure).toBeInstanceOf(AuthUnavailable);
	expect(lookups()).toBe(1);
});
