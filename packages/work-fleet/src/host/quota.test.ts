import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { codexQuota, unlimitedQuota } from "#host/quota.ts";

describe("work-fleet quota", () => {
	it.effect("ordinary Codex usage admits without a flat cap and is cached for a minute", function* () {
		let reads = 0;
		let clock = 1000;
		let allowed = true;
		const refresh = codexQuota(
			() => clock,
			Effect.sync(() => {
				reads += 1;
				return { ordinaryUsageAllowed: allowed, primary: { usedPercent: 12 } };
			}),
		);
		expect(yield* refresh()).toEqual({ available: Number.MAX_SAFE_INTEGER, expiresAt: 61_000, observedAt: 1000 });
		allowed = false;
		clock = 30_000;
		expect((yield* refresh()).available).toBe(Number.MAX_SAFE_INTEGER);
		expect(reads).toBe(1);
		clock = 61_000;
		expect(yield* refresh()).toEqual({ available: 0, expiresAt: 121_000, observedAt: 61_000 });
		expect(reads).toBe(2);
	});

	it.effect("an unknown rate limit shape is an integration failure", function* () {
		const failure = yield* codexQuota(() => 0, Effect.succeed({ limits: [] }))().pipe(Effect.flip);
		expect(failure.reason).toBe("integration");
	});

	it.effect("the unlimited policy always admits", function* () {
		expect(yield* unlimitedQuota(() => 5)).toEqual({ available: Number.MAX_SAFE_INTEGER, expiresAt: 60_005, observedAt: 5 });
	});
});
