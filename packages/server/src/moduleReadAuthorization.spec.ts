import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { readPolicyHost } from "#test/read-policy/host.ts";

readPolicyHost.it(
	"a read denied by its policy without identity middleware fails with query read denied before its handler or any session lookup runs",
	[],
	function* ({ handledReads, plainRead, policyChecks, sessionLookups }) {
		const answer = yield* plainRead();

		yield* outcomes({
			"answer": [Effect.succeed(answer), "failed with query read denied"],
			"handled reads": [handledReads(), []],
			"policy checks": [policyChecks(), ["document private for no viewer"]],
			"session lookups": [sessionLookups(), []],
		});
	},
);

for (const boundary of ["account.get", "profile.get"] as const) {
	readPolicyHost.it(
		`through ${boundary}, alice reads her document after its policy checks alice's session`,
		[],
		function* ({ policyChecks, read, sessionLookups }) {
			const answer = yield* read(boundary, "alice", "alice");

			yield* outcomes({
				"answer": [Effect.succeed(answer), "Alice's document"],
				"policy checks": [policyChecks(), ["document alice for alice", "document alice for alice"]],
				"session lookups": [sessionLookups(), ["alice"]],
			});
		},
	);

	readPolicyHost.it(
		`through ${boundary}, bob reading alice's document fails with query read denied after its policy checks bob's session`,
		[],
		function* ({ policyChecks, read }) {
			const answer = yield* read(boundary, "bob", "alice");

			yield* outcomes({
				"answer": [Effect.succeed(answer), "failed with query read denied"],
				"policy checks": [policyChecks(), ["document alice for bob"]],
			});
		},
	);
}

readPolicyHost.it("a public read without a session reaches its policy with no viewer", [], function* ({ policyChecks, publicRead }) {
	const answer = yield* publicRead();

	yield* outcomes({
		"answer": [Effect.succeed(answer), "Public documents"],
		"policy checks": [policyChecks(), ["the document list for no viewer", "the document list for no viewer"]],
	});
});

readPolicyHost.it("a public read with alice's session reaches its policy with alice as viewer", [], function* ({ policyChecks, publicRead }) {
	const answer = yield* publicRead("alice");

	yield* outcomes({
		"answer": [Effect.succeed(answer), "Public documents"],
		"policy checks": [policyChecks(), ["the document list for alice", "the document list for alice"]],
	});
});

readPolicyHost.it("alice's socket subscription hears only the change to her own document", [], function* ({ listen, nextHint, publish }) {
	yield* listen("alice");

	yield* publish();

	expect(yield* nextHint("alice")).toBe("changed alice");
});

for (const revoke of ["revokeRead", "revokeSession"] as const) {
	readPolicyHost.it(
		`when ${revoke === "revokeRead" ? "the read policy" : "the session"} denies alice, her subscription fails with query read denied on the next change without a hint`,
		[],
		function* (verbs) {
			yield* verbs.listen("alice");

			yield* verbs[revoke]("alice");
			yield* verbs.publish();

			expect(yield* verbs.subscriptionOutcome("alice")).toEqual({ ending: "failed with query read denied", hints: ["resync"] });
		},
	);
}
