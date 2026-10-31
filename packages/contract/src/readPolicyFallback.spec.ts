import { expect } from "vitest";
import { missingPolicy, policyFallbackStory } from "#test/policyFallbackStory.ts";

for (const path of ["read", "subscribe"] as const) {
	policyFallbackStory.it(
		`an untyped query without a policy is refused on ${path} through a native server that bypasses host validation`,
		[missingPolicy],
		function* (verbs) {
			const answer = yield* verbs[path]("alice");

			expect(answer).toBe("failed with missing read policy: Declare a readPolicy on query read before reading it or subscribing");
		},
	);
}

for (const [viewer, readAnswer, subscriptionAnswer] of [
	["alice", "A note", "subscribed"],
	["signed out", "failed with read denied", "failed with read denied"],
] as const) {
	policyFallbackStory.it(`signedIn answers ${viewer}'s plain read with ${readAnswer}`, [], function* ({ read }) {
		const answer = yield* read(viewer);

		expect(answer).toBe(readAnswer);
	});
	policyFallbackStory.it(`signedIn answers ${viewer}'s subscription with ${subscriptionAnswer}`, [], function* ({ subscribe }) {
		const answer = yield* subscribe(viewer);

		expect(answer).toBe(subscriptionAnswer);
	});
}
