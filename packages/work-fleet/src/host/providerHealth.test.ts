import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { hostPolicyStory } from "#test/hostPolicyStory.ts";

hostPolicyStory.it("retains structured rejection codes without changing provider failures and ignores unrelated rejections", [], function* (policy) {
	for (const explicit of [false, true]) {
		const { transport, health } = yield* policy.healthTransport(explicit);
		const error = yield* transport.startSession({ cwd: "/synthetic", operationId: "synthetic", prompt: "Synthetic" }).pipe(Effect.flip);
		expect(error.reason).toBe("rejected");
		expect((yield* health()).lastCapacityRejection).toEqual(explicit ? { at: 0, cause: "serverOverloaded" } : null);
	}
});
hostPolicyStory.it("bounds terminal rejection history while retaining recent observations", [], function* (policy) {
	const { transport, health } = yield* policy.healthTransport(true, true);
	for (let index = 0; index <= 1024; index += 1) {
		yield* transport.observe({ sessionId: "synthetic", turnId: String(index) });
	}
	const first = (yield* health()).lastCapacityRejection;
	yield* TestClock.adjust("1 minute");
	yield* transport.observe({ sessionId: "synthetic", turnId: "1024" });
	expect((yield* health()).lastCapacityRejection).toEqual(first);
	yield* transport.observe({ sessionId: "synthetic", turnId: "0" });
	expect((yield* health()).lastCapacityRejection).toEqual({ at: 60_000, cause: "serverOverloaded" });
});
hostPolicyStory.it("records a terminal capacity failure once rather than refreshing its timestamp on each poll", [], function* (policy) {
	const { transport, health } = yield* policy.healthTransport(true);
	const receipt = { sessionId: "synthetic-session", turnId: "synthetic-turn" };
	yield* transport.observe(receipt);
	const first = (yield* health()).lastCapacityRejection;
	expect(first?.cause).toBe("serverOverloaded");
	yield* TestClock.adjust("1 minute");
	yield* transport.observe(receipt);
	expect((yield* health()).lastCapacityRejection).toEqual(first);
});
