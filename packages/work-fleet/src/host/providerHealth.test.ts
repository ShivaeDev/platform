import { expect } from "@effect/vitest";
import { hostPolicyStory } from "#test/hostPolicyStory.ts";
import { refusal } from "#test/refusal.ts";

for (const [rejection, explicit, recorded] of [
	["an explicit capacity rejection", true, { at: 0, cause: "serverOverloaded" }],
	["an unrelated rejection", false, null],
] as const) {
	hostPolicyStory.it(
		`${rejection} fails the session as rejected and records ${recorded === null ? "no" : "its"} capacity rejection`,
		[],
		function* (policy) {
			const { transport, health } = yield* policy.healthTransport(explicit);

			const started = yield* refusal(transport.startSession({ cwd: "/synthetic", operationId: "synthetic", prompt: "Synthetic" }));

			expect(started).toMatch(/^session rejected/u);
			expect((yield* health()).lastCapacityRejection).toEqual(recorded);
		},
	);
}

hostPolicyStory.it("a terminal rejection forgotten beyond the bounded history is recorded again", [], function* (policy) {
	const { transport, health } = yield* policy.healthTransport(true, true);
	for (let index = 0; index <= 1024; index += 1) {
		yield* transport.observe({ sessionId: "synthetic", turnId: String(index) });
	}
	yield* policy.elapse("1 minute");

	yield* transport.observe({ sessionId: "synthetic", turnId: "0" });

	expect((yield* health()).lastCapacityRejection).toEqual({ at: 60_000, cause: "serverOverloaded" });
});

hostPolicyStory.it("a recent terminal rejection inside the bounded history keeps its first timestamp", [], function* (policy) {
	const { transport, health } = yield* policy.healthTransport(true, true);
	for (let index = 0; index <= 1024; index += 1) {
		yield* transport.observe({ sessionId: "synthetic", turnId: String(index) });
	}
	const first = (yield* health()).lastCapacityRejection;
	yield* policy.elapse("1 minute");

	yield* transport.observe({ sessionId: "synthetic", turnId: "1024" });

	expect((yield* health()).lastCapacityRejection).toEqual(first);
});

hostPolicyStory.it("a terminal capacity failure is recorded once rather than refreshing its timestamp on each poll", [], function* (policy) {
	const { transport, health } = yield* policy.healthTransport(true);
	const receipt = { sessionId: "synthetic-session", turnId: "synthetic-turn" };
	yield* transport.observe(receipt);
	const first = (yield* health()).lastCapacityRejection;
	expect(first?.cause).toBe("serverOverloaded");
	yield* policy.elapse("1 minute");

	yield* transport.observe(receipt);

	expect((yield* health()).lastCapacityRejection).toEqual(first);
});
