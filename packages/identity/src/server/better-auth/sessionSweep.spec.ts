import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { authStorage, expiredSession, mintedAccounts, withoutAuthHost } from "#test/better-auth/database.ts";

authStorage.it(
	"sweeping removes alice's expired session and leaves bob signed in",
	[mintedAccounts(), expiredSession("alice")],
	function* ({ signedInAs, storedSessions, sweepExpiredSessions }) {
		yield* outcomes({
			"alice's stored sessions": [storedSessions("alice"), 1],
			"bob's cookie": [signedInAs("bob"), "bob"],
		});

		yield* sweepExpiredSessions();

		yield* outcomes({
			"alice's stored sessions": [storedSessions("alice"), 0],
			"bob's cookie": [signedInAs("bob"), "bob"],
		});
	},
);

authStorage.it(
	"a worker that never mounts Better Auth sweeps alice's expired session and keeps bob's",
	[mintedAccounts(), expiredSession("alice"), withoutAuthHost],
	function* ({ storedSessions, sweepExpiredSessions }) {
		yield* outcomes({
			"alice's stored sessions": [storedSessions("alice"), 1],
			"bob's stored sessions": [storedSessions("bob"), 1],
		});

		yield* sweepExpiredSessions();

		yield* outcomes({
			"alice's stored sessions": [storedSessions("alice"), 0],
			"bob's stored sessions": [storedSessions("bob"), 1],
		});
	},
);

authStorage.it(
	"a sweep reports the one expired session it removed, and the next sweep reports none",
	[mintedAccounts(), expiredSession("alice")],
	function* ({ storedSessions, sweepExpiredSessions, sweptSessions }) {
		yield* sweepExpiredSessions();

		yield* outcomes({
			"alice's stored sessions": [storedSessions("alice"), 0],
			"sessions the first sweep reports": [sweptSessions(), 1],
		});

		yield* sweepExpiredSessions();

		expect(yield* sweptSessions()).toBe(0);
	},
);
