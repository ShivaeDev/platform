import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { hostPolicyStory } from "#test/hostPolicyStory.ts";

describe("work-fleet quota", () => {
	hostPolicyStory.it("ordinary Codex usage admits without a flat cap and is cached for a minute", [], function* (policy) {
		expect(yield* policy.quota()).toEqual({ available: Number.MAX_SAFE_INTEGER, expiresAt: 61_000, observedAt: 1000 });
		policy.quotaObservation(30_000, { ordinaryUsageAllowed: false });
		expect((yield* policy.quota()).available).toBe(Number.MAX_SAFE_INTEGER);
		expect(policy.quotaReads()).toBe(1);
		policy.quotaObservation(61_000, { ordinaryUsageAllowed: false });
		expect(yield* policy.quota()).toEqual({ available: 0, expiresAt: 121_000, observedAt: 61_000 });
		expect(policy.quotaReads()).toBe(2);
	});

	hostPolicyStory.it("an unknown rate limit shape is an integration failure", [], function* (policy) {
		policy.quotaObservation(0, { limits: [] });
		const failure = yield* policy.quota().pipe(Effect.flip);
		expect(failure._tag).toBe("ServiceUnavailable");
	});
});
