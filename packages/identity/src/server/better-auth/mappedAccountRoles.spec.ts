import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { existingAccount, listedAccounts, mappedAccountRoles, pluginMappedAccountRoles } from "#test/better-auth/accountRoles.ts";

mappedAccountRoles.it(
	"the boot seed follows mapped account and user columns to grant alice operator",
	[listedAccounts("github:1001"), existingAccount("alice"), existingAccount("bob")],
	function* ({ boot, sessionRole }) {
		yield* boot();

		yield* outcomes([
			["listed alice's role", () => sessionRole("alice"), "operator"],
			["unlisted bob's role", () => sessionRole("bob"), "user"],
		]);
	},
);

mappedAccountRoles.it(
	"the sign-in seed grants alice operator through mapped columns on her first GitHub sign-in",
	[listedAccounts("github:1001")],
	function* ({ boot, signIn, sessionRole }) {
		yield* boot();

		yield* signIn("alice");

		expect(yield* sessionRole("alice")).toBe("operator");
	},
);

mappedAccountRoles.it(
	"the mapped boot seed refuses to demote the last role assigner",
	[listedAccounts("github:1001"), existingAccount("alice", "admin")],
	function* ({ boot, sessionRole }) {
		const answer = yield* boot();

		yield* outcomes([
			["boot refusal", () => Effect.succeed(answer), "last role assigner"],
			["alice's role", () => sessionRole("alice"), "admin"],
		]);
	},
);

for (const [kit, mapping] of [
	[mappedAccountRoles, "additional-field"],
	[pluginMappedAccountRoles, "admin plugin"],
] as const) {
	kit.it(`role-aware migrations and schema checks accept the ${mapping} role mapping`, [], function* ({ checkSchema }) {
		expect(yield* checkSchema()).toBe("matches");
	});
}

pluginMappedAccountRoles.it(
	"the account seed preserves the admin plugin's custom role column",
	[listedAccounts("github:1001"), existingAccount("alice")],
	function* ({ boot, sessionRole }) {
		yield* boot();

		expect(yield* sessionRole("alice")).toBe("operator");
	},
);
