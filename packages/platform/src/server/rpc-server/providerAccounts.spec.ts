import { expect } from "vitest";
import { Unauthorized } from "#errors/taxonomy.ts";
import { expiryDuringAccountLookup } from "#test/rpc/expiryDuringAccountLookup.ts";
import { sessions, signedUp } from "#test/rpc/sessionStory.ts";

sessions.it(
	"a session that expires between its read and the provider account lookup is unauthorized over HTTP",
	[expiryDuringAccountLookup, signedUp("alice")],
	function* ({ whoami }) {
		const result = yield* whoami("alice");
		expect(result._tag === "Failure" && result.failure).toBeInstanceOf(Unauthorized);
	},
);
