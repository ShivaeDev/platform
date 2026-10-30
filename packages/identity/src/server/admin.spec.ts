import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { auth, signedInWithRole } from "#test/auth/story.ts";

const ADMIN_TOOLS = "Admin tools for member@example.test";
const OWNER_TOOLS = "Owner tools for member@example.test";
const grants = [{ name: "tools.use", strength: "own" }];

auth.it(
	"an admin reaches the protected profile, the admin HTTP route and the admin RPC",
	[signedInWithRole("admin")],
	function* ({ callAdminTools, openAdminTools, profile }) {
		yield* outcomes({
			"admin RPC": [callAdminTools(), ADMIN_TOOLS],
			"admin route": [openAdminTools(), { body: ADMIN_TOOLS, status: HttpStatus.fromLiteral("OK") }],
			profile: [
				profile(),
				expect.objectContaining({
					status: HttpStatus.fromLiteral("OK"),
					user: expect.objectContaining({ email: "member@example.test", role: "admin" }),
				}),
			],
		});
	},
);

for (const [caller, traits, refusal, status] of [
	["a signed-in user without a role", [signedInWithRole("user")], "forbidden", HttpStatus.fromLiteral("Forbidden")],
	["a signed-out caller", [], "unauthorized", HttpStatus.fromLiteral("Unauthorized")],
] as const) {
	auth.it(
		`${caller} is refused as ${refusal} by the admin route and the admin and owner RPCs`,
		traits,
		function* ({ callAdminTools, callOwnerTools, openAdminTools }) {
			yield* outcomes({
				"admin RPC": [callAdminTools(), `failed with ${refusal}`],
				"admin route status": [openAdminTools(), expect.objectContaining({ status })],
				"owner RPC": [callOwnerTools(), `failed with ${refusal}`],
			});
		},
	);

	auth.it(`an RPC refused as ${refusal} for ${caller} never runs its handler`, traits, function* ({ adminHandlerRequests, callAdminTools }) {
		yield* callAdminTools();

		expect(yield* adminHandlerRequests()).toEqual([]);
	});
}

auth.it("an owner reaches the owner RPC but not the admin RPC", [signedInWithRole("owner")], function* ({ callAdminTools, callOwnerTools }) {
	yield* outcomes({
		"admin RPC": [callAdminTools(), "failed with forbidden"],
		"owner RPC": [callOwnerTools(), OWNER_TOOLS],
	});
});

auth.it(
	"an admin who is not an owner reaches the admin RPC but not the owner RPC",
	[signedInWithRole("admin")],
	function* ({ callAdminTools, callOwnerTools }) {
		yield* outcomes({
			"admin RPC": [callAdminTools(), ADMIN_TOOLS],
			"owner RPC": [callOwnerTools(), "failed with forbidden"],
		});
	},
);

auth.it(
	"revoking the admin's session refuses the admin route and RPC as unauthorized",
	[signedInWithRole("admin")],
	function* ({ callAdminTools, openAdminTools, revokeSession }) {
		expect(yield* openAdminTools()).toMatchObject({ status: HttpStatus.fromLiteral("OK") });

		yield* revokeSession();

		yield* outcomes({
			"admin RPC": [callAdminTools(), "failed with unauthorized"],
			"admin route": [openAdminTools(), expect.objectContaining({ status: HttpStatus.fromLiteral("Unauthorized") })],
		});
	},
);

auth.it(
	"removing the admin role refuses the same session's next admin route and RPC calls as forbidden",
	[signedInWithRole("admin")],
	function* ({ callAdminTools, openAdminTools, setRole }) {
		expect(yield* callAdminTools()).toBe(ADMIN_TOOLS);

		yield* setRole("user");

		yield* outcomes({
			"admin RPC": [callAdminTools(), "failed with forbidden"],
			"admin route": [openAdminTools(), expect.objectContaining({ status: HttpStatus.fromLiteral("Forbidden") })],
		});
	},
);

auth.it(
	"removing the owner role refuses the next owner RPC call but keeps admin access",
	[signedInWithRole("admin,owner")],
	function* ({ callAdminTools, callOwnerTools, setRole }) {
		expect(yield* callOwnerTools()).toBe(OWNER_TOOLS);

		yield* setRole("admin");

		yield* outcomes({
			"admin RPC": [callAdminTools(), ADMIN_TOOLS],
			"owner RPC": [callOwnerTools(), "failed with forbidden"],
		});
	},
);

auth.it(
	"removing the admin role ends an open admin stream as forbidden",
	[signedInWithRole("admin")],
	function* ({ adminFeedEnding, followAdminFeed, setRole }) {
		expect(yield* followAdminFeed()).toBe("Admin feed for member@example.test");

		yield* setRole("user");

		expect(yield* adminFeedEnding()).toBe("failed with forbidden");
	},
);

auth.it(
	"the client session and the request profile expose the admin role and its exact grants",
	[signedInWithRole("admin")],
	function* ({ clientSession, profile }) {
		yield* outcomes({
			"client session": [
				clientSession(),
				expect.objectContaining({ payload: expect.objectContaining({ user: expect.objectContaining({ permissions: grants, role: "admin" }) }) }),
			],
			profile: [profile(), expect.objectContaining({ user: expect.objectContaining({ permissions: grants, role: "admin" }) })],
		});
	},
);

auth.it(
	"after the admin role is removed, the client session shows the user role with no grants",
	[signedInWithRole("admin")],
	function* ({ clientSession, setRole }) {
		expect(yield* clientSession()).toMatchObject({ payload: { user: { permissions: grants, role: "admin" } } });

		yield* setRole("user");

		expect(yield* clientSession()).toMatchObject({ payload: { user: { permissions: [], role: "user" } }, status: HttpStatus.fromLiteral("OK") });
	},
);

auth.it(
	"an undeclared stored role reaches the admin RPC caller as a defect naming the role",
	[signedInWithRole("retired")],
	function* ({ callAdminTools }) {
		expect(yield* callAdminTools()).toBe("died with Stored user role is not declared by the application: retired");
	},
);

auth.it(
	"an application role not named admin is granted the admin RPC and runs its handler",
	[signedInWithRole("operator")],
	function* ({ adminHandlerRequests, callAdminTools }) {
		const answer = yield* callAdminTools();

		yield* outcomes({
			"admin handler requests": [adminHandlerRequests(), ["adminTools"]],
			answer: [Effect.succeed(answer), ADMIN_TOOLS],
		});
	},
);

auth.it("an own grant reads the caller's own record", [signedInWithRole("admin")], function* ({ currentUserId, readRecord }) {
	expect(yield* readRecord(currentUserId())).toBe(currentUserId());
});

auth.it("an own grant refuses another member's record as forbidden", [signedInWithRole("admin")], function* ({ readRecord, signInProfile }) {
	const other = yield* signInProfile({ email: "other@example.test", name: "Other" });

	expect(yield* readRecord(other.user.id)).toBe("failed with forbidden");
});

auth.it("an explicit any grant reads another member's record", [signedInWithRole("auditor")], function* ({ readRecord, signInProfile }) {
	const other = yield* signInProfile({ email: "other@example.test", name: "Other" });

	expect(yield* readRecord(other.user.id)).toBe(other.user.id);
});
