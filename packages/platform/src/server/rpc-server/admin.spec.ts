import { expect } from "vitest";
import { auth, signedInWithRole } from "#test/auth/story.ts";

auth.it(
	"an admin reaches the admin RPC and the admin HTTP route",
	[signedInWithRole("user,admin")],
	function* ({ openAdminTools, callAdminTools, profile }) {
		expect(yield* profile()).toMatchObject({ status: 200, user: { email: "member@example.test", role: "user,admin" } });
		expect(yield* openAdminTools()).toEqual({ body: "Admin tools for member@example.test", status: 200 });
		expect(yield* callAdminTools()).toMatchObject({ _tag: "Success", success: "Admin tools for member@example.test" });
	},
);

auth.it(
	"a signed-in user without a role is forbidden by the admin and owner RPCs",
	[signedInWithRole("user")],
	function* ({ openAdminTools, callAdminTools, callOwnerTools }) {
		expect((yield* openAdminTools()).status).toBe(403);
		expect(yield* callAdminTools()).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden" } });
		expect(yield* callOwnerTools()).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden" } });
	},
);

auth.it("a signed-out caller is unauthorized by the admin and owner RPCs", [], function* ({ openAdminTools, callAdminTools, callOwnerTools }) {
	expect((yield* openAdminTools()).status).toBe(401);
	expect(yield* callAdminTools()).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
	expect(yield* callOwnerTools()).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
});

auth.it("an owner reaches the owner RPC without holding the admin role", [signedInWithRole("owner")], function* ({ callAdminTools, callOwnerTools }) {
	expect(yield* callOwnerTools()).toMatchObject({ _tag: "Success", success: "Owner tools for member@example.test" });
	expect(yield* callAdminTools()).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden" } });
});

auth.it("an admin who is not owner is forbidden by the owner RPC", [signedInWithRole("admin")], function* ({ callAdminTools, callOwnerTools }) {
	expect(yield* callAdminTools()).toMatchObject({ _tag: "Success" });
	expect(yield* callOwnerTools()).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden" } });
});

auth.it(
	"revoking a minted session closes the admin HTTP route and RPC",
	[signedInWithRole("admin")],
	function* ({ openAdminTools, callAdminTools, revokeSession }) {
		expect((yield* openAdminTools()).status).toBe(200);
		yield* revokeSession();
		expect((yield* openAdminTools()).status).toBe(401);
		expect(yield* callAdminTools()).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
	},
);

auth.it(
	"removing the admin role closes access on the next call with the same session",
	[signedInWithRole("admin")],
	function* ({ openAdminTools, callAdminTools, setRole }) {
		expect((yield* openAdminTools()).status).toBe(200);
		expect(yield* callAdminTools()).toMatchObject({ _tag: "Success" });
		yield* setRole("user");
		expect((yield* openAdminTools()).status).toBe(403);
		expect(yield* callAdminTools()).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden" } });
	},
);

auth.it(
	"removing the owner role closes the owner RPC on the next call",
	[signedInWithRole("admin,owner")],
	function* ({ callAdminTools, callOwnerTools, setRole }) {
		expect(yield* callOwnerTools()).toMatchObject({ _tag: "Success" });
		yield* setRole("admin");
		expect(yield* callOwnerTools()).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden" } });
		expect(yield* callAdminTools()).toMatchObject({ _tag: "Success" });
	},
);

auth.it("removing the admin role ends an open admin stream with forbidden", [signedInWithRole("admin")], function* ({ followAdminFeed, setRole }) {
	const feed = yield* followAdminFeed();
	expect(yield* feed.next).toBe("Admin feed for member@example.test");
	yield* setRole("user");
	expect(yield* feed.ended).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden" } });
});
