import { expect } from "vitest";
import { allowed, organizationRule, policyWaits, signedIn, signInPolicy } from "#test/sign-in-policy/story.ts";

signInPolicy.it(
	"the gate's revocation log carries the RPC request's span and annotations",
	[allowed("alice", "bob"), signedIn("alice")],
	function* ({ gateLogs, remove, request, requestSpans }) {
		yield* remove("alice");

		yield* request("alice");

		const spans = yield* requestSpans();
		expect(spans).toEqual([expect.stringMatching(/^[a-f\d]{32}$/u)]);
		expect(yield* gateLogs()).toEqual([{ method: "Whoami", requestId: "policy-request", traceId: spans[0] }]);
	},
);

signInPolicy.it(
	"cancelling a session lookup interrupts its waiting policy check",
	[organizationRule, signedIn("alice"), policyWaits],
	function* ({ cancelRequest, policyInterrupted, recheckIntervalPasses }) {
		yield* recheckIntervalPasses();

		yield* cancelRequest("alice");

		expect(yield* policyInterrupted()).toBe(true);
	},
);
