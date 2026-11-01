import { expect } from "vitest";
import { limit } from "#test/makeLimiter.ts";
import { memory } from "#test/memory.ts";

memory.it("admits calls up to the per-key limit", [], function* ({ burst }) {
	const admitted = yield* burst(limit.per, limit);

	expect(admitted).toEqual(["admitted", "admitted"]);
});

memory.it("refuses excess calls with TooManyRequests and the window's retry time", [], function* ({ attempt, now }) {
	const started = yield* now();
	yield* attempt();
	yield* attempt();

	const refused = yield* attempt();

	expect(refused).toEqual({ key: "notes:alice", refusal: "TooManyRequests", retryAt: started + 60_000 });
});

memory.it("admits another key while alice's window is full", [], function* ({ attempt }) {
	yield* attempt();
	yield* attempt();

	const bob = yield* attempt({ ...limit, key: "notes:bob" });

	expect(bob).toBe("admitted");
});

memory.it("refuses before expiry and admits at the window boundary on TestClock", [], function* ({ attempt, passTime }) {
	yield* attempt();
	yield* attempt();
	yield* passTime("59999 millis");
	expect(yield* attempt()).toMatchObject({ refusal: "TooManyRequests" });

	yield* passTime("1 milli");

	expect(yield* attempt()).toBe("admitted");
});

for (const [name, options] of [
	["zero count", { per: 0 }],
	["fractional count", { per: 1.5 }],
	["zero window", { window: 0 }],
	["infinite window", { window: Number.POSITIVE_INFINITY }],
] as const) {
	memory.it(`rejects a policy with a ${name}`, [], function* ({ invalid }) {
		const result = yield* invalid({ ...limit, ...options });

		expect(result).toBe("invalid limit");
	});
}

memory.it("concurrent memory calls share one remaining admission", [], function* ({ burst, now }) {
	const started = yield* now();

	const results = yield* burst(2, { ...limit, per: 1 });

	expect(results).toEqual(expect.arrayContaining(["admitted", { key: "notes:alice", refusal: "TooManyRequests", retryAt: started + 60_000 }]));
});

memory.it("the JSON RPC client decodes a rate-limit refusal as the shared TooManyRequests with its retry details", [], function* ({ request }) {
	yield* request();
	yield* request();

	const refused = yield* request();

	expect(refused).toEqual({
		key: "notes:alice",
		message: "Rate limit exceeded",
		refusal: "shared TooManyRequests",
		retryAt: expect.any(Number),
	});
});
