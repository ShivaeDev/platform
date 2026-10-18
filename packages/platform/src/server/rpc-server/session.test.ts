import { Effect } from "effect";
import { expect } from "vitest";
import { AuthUnavailable, Forbidden, Unauthorized } from "#errors/taxonomy.ts";
import { trustedOrigins } from "#rpc-server/origin.ts";
import { ORIGIN } from "#test/rpc/harness.ts";
import { originPolicy, publicWithoutOrigin, sessions, signedUp } from "#test/rpc/sessionStory.ts";

sessions.it(
	"Better Auth sessions give each concurrent native RPC request its own identity",
	[originPolicy(), signedUp("alice", "bob")],
	function* ({ account, whoami, readOwn, greeting, annotations, spans }) {
		const alice = account("alice");
		const bob = account("bob");
		const users = Array.from({ length: 12 }, (_, index) => ({ ...(index % 2 === 0 ? alice : bob), requestId: `request-${index}` }));
		const results = yield* Effect.all(
			users.map((user, index) => whoami(index % 2 === 0 ? "alice" : "bob", { "x-request-id": user.requestId })),
			{ concurrency: "unbounded" },
		);
		results.forEach((result, index) => {
			expect(result).toMatchObject({ _tag: "Success", success: `${users[index]?.userId} ${users[index]?.requestId}` });
		});
		const handled = annotations("handled");
		expect(handled).toHaveLength(users.length);
		for (const user of users) {
			expect(handled).toContainEqual(expect.objectContaining({ requestId: user.requestId, "rpc.method": "Whoami", userId: user.userId }));
			const span = spans().find((candidate) => candidate.attributes.get("request.id") === user.requestId);
			expect(span?.name).toBe("Whoami");
			expect(span?.attributes.get("user.id")).toBe(user.userId);
		}
		const denied = yield* readOwn("alice", "bob");
		expect(denied).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden", message: "Not your account" } });
		expect(denied._tag === "Failure" && denied.failure).toBeInstanceOf(Forbidden);
		expect(yield* greeting("bob")).toMatchObject({
			_tag: "Success",
			success: `hello ${bob.userId}`,
		});
		expect(yield* greeting()).toMatchObject({ _tag: "Success", success: "hello anonymous" });
	},
);
sessions.it(
	"missing sessions are unauthorized while provider failures are reported as unavailable",
	[originPolicy(), signedUp("alice")],
	function* ({ account, whoami, greeting, closeProvider, annotations, logs }) {
		const alice = account("alice");
		const missing = yield* whoami();
		expect(missing).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
		expect(yield* whoami("alice", { cookie: `${alice.cookie}tampered` })).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Unauthorized" },
		});
		expect(missing._tag === "Failure" && missing.failure).toBeInstanceOf(Unauthorized);
		yield* closeProvider();
		const outage = yield* whoami("alice");
		expect(outage).toMatchObject({ _tag: "Failure", failure: { _tag: "AuthUnavailable", message: "Authentication is temporarily unavailable" } });
		expect(outage._tag === "Failure" && outage.failure).toBeInstanceOf(AuthUnavailable);
		expect(yield* greeting("alice")).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "AuthUnavailable" },
		});
		const failures = logs().filter(
			(log) => log.level === "Error" && Array.isArray(log.message) && log.message.includes("Authentication provider failed"),
		);
		expect(failures.length).toBeGreaterThanOrEqual(2);
		expect(failures[0]?.annotations).toMatchObject({ "rpc.method": "Whoami" });
		expect(annotations("RPC failure")).toContainEqual(expect.objectContaining({ "rpc.failure": "AuthUnavailable" }));
	},
);
sessions.it(
	"sign-out through Better Auth's HTTP handler rejects the retained cookie as unauthorized",
	[originPolicy(), signedUp("alice")],
	function* ({ account, readOwn, signout }) {
		const alice = account("alice");
		expect(yield* readOwn("alice", "alice")).toMatchObject({ _tag: "Success", success: alice.userId });
		const response = yield* signout("alice");
		expect(response.status).toBe(200);
		const revoked = yield* readOwn("alice", "alice");
		expect(revoked).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
		expect(revoked._tag === "Failure" && revoked.failure).toBeInstanceOf(Unauthorized);
	},
);
sessions.it(
	"a persisted Better Auth session with backdated expiry is unauthorized",
	[originPolicy(), signedUp("alice")],
	function* ({ account, readOwn, expire }) {
		const alice = account("alice");
		expect(yield* readOwn("alice", "alice")).toMatchObject({ _tag: "Success", success: alice.userId });
		expect(yield* expire("alice")).toBe(1);
		const expired = yield* readOwn("alice", "alice");
		expect(expired).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
		expect(expired._tag === "Failure" && expired.failure).toBeInstanceOf(Unauthorized);
	},
);
sessions.it(
	"origin policy is an explicit decision evaluated before the provider is consulted",
	[originPolicy(), originPolicy("permissive", trustedOrigins({ allow: [ORIGIN], missing: "allow" })), publicWithoutOrigin, signedUp("alice")],
	function* ({ account, greeting, identity, lookups }) {
		const alice = account("alice");
		function ask(policy: string, headers: Record<string, string>) {
			return identity({ cookie: alice.cookie, ...headers }, policy);
		}
		const success = { _tag: "Success", success: alice.userId };
		const forbidden = { _tag: "Failure", failure: { _tag: "Forbidden", message: "Origin not allowed" } };
		expect(yield* ask("browser", { origin: ORIGIN })).toMatchObject(success);
		expect(yield* ask("browser", { origin: "capacitor://localhost" })).toMatchObject(success);
		const before = lookups();
		expect(yield* ask("browser", { origin: "https://attacker.example" })).toMatchObject(forbidden);
		expect(yield* ask("browser", { origin: "null" })).toMatchObject(forbidden);
		expect(yield* ask("browser", {})).toMatchObject(forbidden);
		expect(yield* greeting("alice", { cookie: alice.cookie })).toMatchObject(forbidden);
		expect(lookups()).toBe(before);
		expect(yield* ask("permissive", {})).toMatchObject(success);
		expect(yield* ask("permissive", { origin: "capacitor://localhost" })).toMatchObject(forbidden);
		expect(yield* ask("custom", {})).toMatchObject(forbidden);
		expect(yield* greeting("alice", { cookie: alice.cookie }, "custom")).toMatchObject({
			_tag: "Success",
			success: `hello ${alice.userId}`,
		});
	},
);
