import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { auth, signedInWithRole } from "#test/auth/story.ts";

auth.it(
	"an admin reaches the admin RPC and the admin HTTP route",
	[signedInWithRole("admin")],
	function* ({ openAdminTools, callAdminTools, profile }) {
		expect(yield* profile()).toMatchObject({
			status: HttpStatus.fromLiteral("OK"),
			user: { email: "member@example.test", role: "admin" },
		});
		expect(yield* openAdminTools()).toEqual({
			body: "Admin tools for member@example.test",
			status: HttpStatus.fromLiteral("OK"),
		});
		expect(yield* callAdminTools()).toMatchObject({
			_tag: "Success",
			success: "Admin tools for member@example.test",
		});
	},
);

auth.it(
	"a signed-in user without a role is forbidden by the admin and owner RPCs",
	[signedInWithRole("user")],
	function* ({ openAdminTools, callAdminTools, callOwnerTools }) {
		expect((yield* openAdminTools()).status).toBe(HttpStatus.fromLiteral("Forbidden"));
		expect(yield* callAdminTools()).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Forbidden" },
		});
		expect(yield* callOwnerTools()).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Forbidden" },
		});
	},
);

auth.it("a signed-out caller is unauthorized by the admin and owner RPCs", [], function* ({ openAdminTools, callAdminTools, callOwnerTools }) {
	expect((yield* openAdminTools()).status).toBe(HttpStatus.fromLiteral("Unauthorized"));
	expect(yield* callAdminTools()).toMatchObject({
		_tag: "Failure",
		failure: { _tag: "Unauthorized" },
	});
	expect(yield* callOwnerTools()).toMatchObject({
		_tag: "Failure",
		failure: { _tag: "Unauthorized" },
	});
});

auth.it("an owner reaches the owner RPC without holding the admin role", [signedInWithRole("owner")], function* ({ callAdminTools, callOwnerTools }) {
	expect(yield* callOwnerTools()).toMatchObject({
		_tag: "Success",
		success: "Owner tools for member@example.test",
	});
	expect(yield* callAdminTools()).toMatchObject({
		_tag: "Failure",
		failure: { _tag: "Forbidden" },
	});
});

auth.it("an admin who is not owner is forbidden by the owner RPC", [signedInWithRole("admin")], function* ({ callAdminTools, callOwnerTools }) {
	expect(yield* callAdminTools()).toMatchObject({ _tag: "Success" });
	expect(yield* callOwnerTools()).toMatchObject({
		_tag: "Failure",
		failure: { _tag: "Forbidden" },
	});
});

auth.it(
	"revoking a minted session closes the admin HTTP route and RPC",
	[signedInWithRole("admin")],
	function* ({ openAdminTools, callAdminTools, revokeSession }) {
		expect((yield* openAdminTools()).status).toBe(HttpStatus.fromLiteral("OK"));
		yield* revokeSession();
		expect((yield* openAdminTools()).status).toBe(HttpStatus.fromLiteral("Unauthorized"));
		expect(yield* callAdminTools()).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Unauthorized" },
		});
	},
);

auth.it(
	"removing the admin role closes access on the next call with the same session",
	[signedInWithRole("admin")],
	function* ({ openAdminTools, callAdminTools, setRole }) {
		expect((yield* openAdminTools()).status).toBe(HttpStatus.fromLiteral("OK"));
		expect(yield* callAdminTools()).toMatchObject({ _tag: "Success" });
		yield* setRole("user");
		expect((yield* openAdminTools()).status).toBe(HttpStatus.fromLiteral("Forbidden"));
		expect(yield* callAdminTools()).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Forbidden" },
		});
	},
);

auth.it(
	"removing the owner role closes the owner RPC on the next call",
	[signedInWithRole("admin,owner")],
	function* ({ callAdminTools, callOwnerTools, setRole }) {
		expect(yield* callOwnerTools()).toMatchObject({ _tag: "Success" });
		yield* setRole("admin");
		expect(yield* callOwnerTools()).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Forbidden" },
		});
		expect(yield* callAdminTools()).toMatchObject({ _tag: "Success" });
	},
);

auth.it("removing the admin role ends an open admin stream with forbidden", [signedInWithRole("admin")], function* ({ followAdminFeed, setRole }) {
	const feed = yield* followAdminFeed();
	expect(yield* feed.next).toBe("Admin feed for member@example.test");
	yield* setRole("user");
	expect(yield* feed.ended).toMatchObject({
		_tag: "Failure",
		failure: { _tag: "Forbidden" },
	});
});

auth.it(
	"the client session and request profile expose the decoded role and its exact grants",
	[signedInWithRole("admin")],
	function* ({ clientSession, profile, setRole }) {
		expect(yield* clientSession()).toMatchObject({
			payload: {
				user: {
					permissions: [{ name: "tools.use", strength: "own" }],
					role: "admin",
				},
			},
			status: HttpStatus.fromLiteral("OK"),
		});
		expect(yield* profile()).toMatchObject({
			status: HttpStatus.fromLiteral("OK"),
			user: {
				permissions: [{ name: "tools.use", strength: "own" }],
				role: "admin",
			},
		});
		yield* setRole("user");
		expect(yield* clientSession()).toMatchObject({
			payload: { user: { permissions: [], role: "user" } },
			status: HttpStatus.fromLiteral("OK"),
		});
	},
);

for (const { role, failure } of [
	{ failure: "Forbidden", role: "user" },
	{ failure: "Unauthorized", role: undefined },
]) {
	auth.it(
		`a ${failure} RPC never runs its handler`,
		role === undefined ? [] : [signedInWithRole(role)],
		function* ({ callAdminTools, adminHandlerRequests }) {
			expect(yield* callAdminTools()).toMatchObject({
				_tag: "Failure",
				failure: { _tag: failure },
			});
			expect(yield* adminHandlerRequests()).toEqual([]);
		},
	);
}

auth.it(
	"an undeclared stored role fails visibly instead of granting access",
	[signedInWithRole("retired")],
	function* ({ callAdminTools, adminHandlerRequests }) {
		expect(yield* callAdminTools()).toMatchObject({
			_tag: "Failure",
			failure: {
				_tag: "AuthUnavailable",
				message: "Stored user role is not declared by the application",
			},
		});
		expect(yield* adminHandlerRequests()).toEqual([]);
	},
);

auth.it(
	"an application role grants entry without being named admin",
	[signedInWithRole("operator")],
	function* ({ callAdminTools, adminHandlerRequests }) {
		expect(yield* callAdminTools()).toMatchObject({
			_tag: "Success",
			success: "Admin tools for member@example.test",
		});
		expect(yield* adminHandlerRequests()).toEqual(["adminTools"]);
	},
);

auth.it(
	"an own grant checks the record owner read from PostgreSQL",
	[signedInWithRole("admin")],
	function* ({ currentUserId, readRecord, signInProfile }) {
		expect(yield* readRecord(currentUserId())).toMatchObject({
			_tag: "Success",
			success: currentUserId(),
		});
		const other = yield* signInProfile({
			email: "other@example.test",
			name: "Other",
		});
		expect(yield* readRecord(other.user.id)).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Forbidden" },
		});
	},
);

auth.it("an explicit any grant permits a different record owner", [signedInWithRole("auditor")], function* ({ readRecord, signInProfile }) {
	const other = yield* signInProfile({
		email: "other@example.test",
		name: "Other",
	});
	expect(yield* readRecord(other.user.id)).toMatchObject({
		_tag: "Success",
		success: other.user.id,
	});
});
