import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceSignedIn, aliceWithoutEmailVerified, originForbidden, profile, providerOutage, signedOut } from "#test/rpc/profile.ts";

profile.it(
	"a handler sees alice's Identity as her id alone and her session user as her email, its confirmation, id and name, without the provider's private field",
	[aliceSignedIn],
	function* ({ whoami }) {
		expect(yield* whoami()).toEqual({
			identity: { id: "alice" },
			user: { email: "alice@example.test", emailVerified: true, id: "alice", name: "Alice" },
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

profile.it(
	"a custom provider's user without emailVerified fails a SessionUser operation as auth unavailable and logs the missing field without values",
	[aliceWithoutEmailVerified],
	function* ({ answer, errors, whoami }) {
		yield* whoami();

		yield* outcomes([
			["answer", () => answer(), "auth unavailable"],
			[
				"errors",
				() => errors(),
				[
					[
						"The session provider returned a user without a valid emailVerified, so the request fails with AuthUnavailable. A provider that serves SessionUser returns id, name, email and emailVerified on its user.",
					],
				],
			],
		]);
	},
);

profile.it(
	"a custom provider's user without emailVerified still serves an operation that reads only Identity",
	[aliceWithoutEmailVerified],
	function* ({ whoamiById }) {
		expect(yield* whoamiById()).toEqual({ id: "alice" });
	},
);
