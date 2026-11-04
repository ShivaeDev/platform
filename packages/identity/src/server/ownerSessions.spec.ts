import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ownerStory } from "#test/local-owner/story.ts";

ownerStory.it("the launching client reads as the owner and its command audits the owner", [], function* ({ audit, manage, profile }) {
	yield* outcomes([
		["owner profile", () => profile("owner"), { actor: "local-owner", role: "owner" }],
		["owner command", () => manage("owner"), "local-owner"],
		["audited person", audit, ["local-owner"]],
	]);
});

for (const caller of ["missing", "invalid"] as const) {
	ownerStory.it(`a loopback request with ${caller} credentials is refused`, [], function* ({ profile }) {
		expect(yield* profile(caller)).toBe("failed with unauthorized");
	});
}

for (const socket of [false, true]) {
	ownerStory.it(
		`a narrow machine scope reads but cannot run an owner command over ${socket ? "WebSocket" : "HTTP"}`,
		[],
		function* ({ audit, manage, profile }) {
			yield* outcomes([
				["reader profile", () => profile("machine"), { actor: "local-owner", role: "reader" }],
				["owner command", () => manage("machine", socket), "failed with forbidden"],
				["no command was executed", audit, []],
			]);
		},
	);
}

ownerStory.it("a revoked machine credential fails on its next HTTP request while the owner keeps access", [], function* ({ profile, revoke }) {
	expect(yield* profile("machine")).toEqual({ actor: "local-owner", role: "reader" });
	yield* revoke();
	yield* outcomes([
		["revoked credential", () => profile("machine"), "failed with unauthorized"],
		["owner retains access", () => profile("owner"), { actor: "local-owner", role: "owner" }],
	]);
});

ownerStory.it(
	"revocation closes an open first-frame-authenticated live query on revalidation",
	[],
	function* ({ openLiveQuery, revalidationIntervalPasses, revoke, subscriptionClosed, subscriptionUpdate }) {
		yield* openLiveQuery();
		expect(yield* subscriptionUpdate()).toBe("Resync");
		yield* revoke();
		yield* revalidationIntervalPasses();
		expect(yield* subscriptionClosed()).toEqual({ code: 1008, reason: "Authentication required" });
	},
);

ownerStory.it("an undeclared machine scope is refused before issuing a credential", [], function* ({ scopeNotDeclared }) {
	expect(yield* scopeNotDeclared()).toBe("failed with schema error");
});

ownerStory.it("the owner credential works as a first-frame bearer", [], function* ({ manage }) {
	expect(yield* manage("owner", true)).toBe("local-owner");
});

ownerStory.it(
	"a fresh provider preserves machine credentials and replaces its process-local owner credential",
	[],
	function* ({ profile, rebuildHost, revoke }) {
		yield* rebuildHost();
		yield* outcomes([
			["old owner credential", () => profile("previous owner"), "failed with unauthorized"],
			["new owner credential", () => profile("owner"), { actor: "local-owner", role: "owner" }],
			["persisted machine credential", () => profile("machine"), { actor: "local-owner", role: "reader" }],
		]);
		yield* revoke();
		expect(yield* profile("machine")).toBe("failed with unauthorized");
	},
);
