import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceSignedIn, originForbidden, profile, providerOutage, signedOut } from "#test/rpc/profile.ts";

profile.it(
	"a handler sees alice's Identity as her id alone and her session user as her email, id and name, without the provider's private field",
	[aliceSignedIn],
	function* ({ whoami }) {
		expect(yield* whoami()).toEqual({
			identity: { id: "alice" },
			user: { email: "alice@example.test", id: "alice", name: "Alice" },
		});
	},
);

profile.it(
	"a forbidden origin is refused before the session provider is asked, with a warning that names the origin",
	[aliceSignedIn, originForbidden],
	function* ({ answer, sessionLookups, warnings, whoami }) {
		yield* whoami();

		yield* outcomes([
			["answer", () => answer(), "forbidden"],
			["session lookups", () => sessionLookups(), 0],
			[
				"warnings",
				() => warnings(),
				[
					[
						"The session policy refused origin https://elsewhere.example calling Whoami. Add the origin to the policy's trusted origins if the application is served from it.",
					],
				],
			],
		]);
	},
);

profile.it("a caller without a session is unauthorized", [signedOut], function* ({ whoami }) {
	expect(yield* whoami()).toBe("unauthorized");
});

profile.it("while the session provider is down, a caller is told auth is unavailable", [providerOutage], function* ({ whoami }) {
	expect(yield* whoami()).toBe("auth unavailable");
});
