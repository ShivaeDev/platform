import { expect } from "vitest";
import { auth, signedInWithRole } from "#test/auth/story.ts";

auth.it(
	"an admin reaches the protected HTTP route and RPC handler",
	[signedInWithRole("user,admin")],
	function* ({ openAdminTools, callAdminTools, profile }) {
		expect(yield* profile()).toMatchObject({ status: 200, user: { email: "member@example.test", role: "user,admin" } });
		expect(yield* openAdminTools()).toEqual({ body: "Admin tools for member@example.test", status: 200 });
		expect(yield* callAdminTools()).toMatchObject({ _tag: "Success", success: "Admin tools for member@example.test" });
	},
);

auth.it("a signed-in user receives forbidden from the admin guard", [signedInWithRole("user")], function* ({ openAdminTools, callAdminTools }) {
	expect((yield* openAdminTools()).status).toBe(403);
	expect(yield* callAdminTools()).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden" } });
});

auth.it("a signed-out request receives unauthorized", [], function* ({ openAdminTools, callAdminTools }) {
	expect((yield* openAdminTools()).status).toBe(401);
	expect(yield* callAdminTools()).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
});

auth.it(
	"revoking a minted session closes the protected HTTP route and RPC handler",
	[signedInWithRole("admin")],
	function* ({ openAdminTools, callAdminTools, revokeSession }) {
		expect((yield* openAdminTools()).status).toBe(200);
		yield* revokeSession();
		expect((yield* openAdminTools()).status).toBe(401);
		expect(yield* callAdminTools()).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
	},
);

auth.it(
	"removing the admin role closes access on the next request with the same session",
	[signedInWithRole("admin")],
	function* ({ openAdminTools, callAdminTools, setRole }) {
		expect((yield* openAdminTools()).status).toBe(200);
		expect(yield* callAdminTools()).toMatchObject({ _tag: "Success" });
		yield* setRole("user");
		expect((yield* openAdminTools()).status).toBe(403);
		expect(yield* callAdminTools()).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden" } });
	},
);
