import { expect } from "vitest";
import { accountRoles, existingAccount, listedAccounts } from "#test/better-auth/accountRoles.ts";

accountRoles.it(
	"listed alice receives operator on her first GitHub sign-in",
	[listedAccounts(" github : 1001 ")],
	function* ({ boot, signIn, sessionRole }) {
		yield* boot();

		yield* signIn("alice");

		expect(yield* sessionRole("alice")).toBe("operator");
	},
);

accountRoles.it(
	"existing listed alice receives operator at boot without a users page or Reactivity",
	[listedAccounts("github:1001"), existingAccount("alice")],
	function* ({ boot, sessionRole }) {
		expect(yield* sessionRole("alice")).toBe("user");

		yield* boot();

		expect(yield* sessionRole("alice")).toBe("operator");
	},
);

accountRoles.it(
	"unlisted bob keeps his stored default role at boot",
	[listedAccounts("github:1001"), existingAccount("bob")],
	function* ({ boot, sessionRole }) {
		yield* boot();

		expect(yield* sessionRole("bob")).toBe("user");
	},
);

for (const entries of ["", undefined]) {
	accountRoles.it(
		`an ${entries === undefined ? "unset" : "empty"} account list grants alice nothing`,
		[listedAccounts(entries), existingAccount("alice")],
		function* ({ boot, sessionRole }) {
			yield* boot();

			expect(yield* sessionRole("alice")).toBe("user");
		},
	);
}

accountRoles.it("a listed account that has never signed in does not prevent boot", [listedAccounts("github:9999")], function* ({ boot }) {
	expect(yield* boot()).toBe("started");
});

accountRoles.it(
	"an account ID listed for another provider does not grant alice operator",
	[listedAccounts("gitlab:1001"), existingAccount("alice")],
	function* ({ boot, sessionRole }) {
		yield* boot();

		expect(yield* sessionRole("alice")).toBe("user");
	},
);

accountRoles.it("a malformed GitHub account refuses boot with its config variable", [listedAccounts("github:octocat")], function* ({ boot }) {
	expect(yield* boot()).toMatch(/invalid config: .*github:octocat.*AUTH_OPERATOR_ACCOUNTS/su);
});

accountRoles.it(
	"the boot grant refreshes the existing Users observer to alice's stored operator role",
	[listedAccounts("github:1001"), existingAccount("alice")],
	function* ({ boot, observeUsers, observedStoredRoles }) {
		yield* observeUsers();
		expect(yield* observedStoredRoles()).toEqual([{ email: "alice@github.test", role: "user" }]);

		yield* boot();

		expect(yield* observedStoredRoles()).toEqual([{ email: "alice@github.test", role: "operator" }]);
	},
);

accountRoles.it(
	"removing alice from config keeps her granted operator role after reboot",
	[listedAccounts("github:1001"), existingAccount("alice")],
	function* ({ boot, removeAccounts, sessionRole }) {
		yield* boot();
		expect(yield* sessionRole("alice")).toBe("operator");
		yield* removeAccounts();

		yield* boot();

		expect(yield* sessionRole("alice")).toBe("operator");
	},
);

accountRoles.it(
	"the seed refuses to replace the last admin's role and preserves alice's admin session",
	[listedAccounts("github:1001"), existingAccount("alice", "admin")],
	function* ({ boot, sessionRole }) {
		expect(yield* sessionRole("alice")).toBe("admin");

		const startup = yield* boot();

		expect(startup).toBe("last role assigner");

		expect(yield* sessionRole("alice")).toBe("admin");
	},
);
