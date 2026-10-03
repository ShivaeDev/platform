import { expect } from "@effect/vitest";
import { Cause, Clock, Context, Effect, Exit, Layer } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { eventually, makeEffectIt } from "../src/index.ts";

class Token extends Context.Service<Token, string>()("@test/Token") {}

const aroundLog: string[] = [];

const { effectApp } = makeEffectIt({
	around: (effect) =>
		Effect.gen(function* () {
			aroundLog.push("enter");
			const value = yield* effect;
			aroundLog.push("exit");
			return value;
		}),
	layer: Layer.succeed(Token, "from-layer"),
	makeHarness: (context) =>
		Effect.gen(function* () {
			return {
				name: context.task.name,
				token: yield* Token,
			};
		}),
});

effectApp("runs a generator body with the harness and Layer services", function* (harness, context) {
	expect(harness.token).toBe("from-layer");
	expect(harness.name).toContain("runs a generator body");
	expect(context.task.name).toContain("runs a generator body");
	expect(yield* Token).toBe("from-layer");
	expect(aroundLog.at(-1)).toBe("enter");
});

effectApp("installs TestClock by default", function* () {
	expect(yield* Clock.currentTimeMillis).toBe(0);
	yield* TestClock.adjust("1 second");
	expect(yield* Clock.currentTimeMillis).toBe(1000);
});

effectApp(
	"uses the live clock when a test overrides it",
	function* () {
		expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
	},
	{ clock: "live" },
);

const liveIt = makeEffectIt({
	clock: "live",
	layer: Layer.succeed(Token, "from-layer"),
	makeHarness: () => Effect.succeed({}),
});

liveIt.effectApp("uses the live clock when the factory sets it", function* () {
	expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
});

liveIt.effectApp(
	"restores TestClock when a test overrides a live factory",
	function* () {
		expect(yield* Clock.currentTimeMillis).toBe(0);
	},
	{ clock: "test" },
);

effectApp.each(["alpha", "beta"])("passes table cases to the generator for %s", function* (item, harness) {
	expect(harness.name).toContain(item);
	expect(harness.token).toBe("from-layer");
	return yield* Effect.void;
});

effectApp("retries at the configured interval using the test clock", function* () {
	const seen: number[] = [];
	const value = yield* eventually(
		Effect.gen(function* () {
			const now = yield* Clock.currentTimeMillis;
			seen.push(now);
			if (now < 50) {
				return yield* Effect.fail("too-early");
			}
			return now;
		}),
		{ interval: "7 millis" },
	);

	expect(value).toBe(56);
	expect(seen).toEqual([0, 7, 14, 21, 28, 35, 42, 49, 56]);
	expect(yield* Clock.currentTimeMillis).toBe(56);
});

effectApp(
	"retries with Schedule.spaced under the live clock",
	function* () {
		let attempts = 0;
		const value = yield* eventually(
			Effect.sync(() => {
				attempts += 1;
				return attempts;
			}).pipe(Effect.flatMap((count) => (count >= 3 ? Effect.succeed("ready") : Effect.fail("not-yet")))),
			{ interval: "1 millis", times: 5 },
		);
		expect(value).toBe("ready");
		expect(attempts).toBe(3);
		expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
	},
	{ clock: "live" },
);

for (const clock of ["test", "live"] as const) {
	effectApp(
		`stops after the configured retries under the ${clock} clock`,
		function* () {
			for (const times of [0, 2]) {
				let attempts = 0;
				const exit = yield* Effect.exit(
					eventually(
						Effect.suspend(() => {
							attempts += 1;
							return Effect.fail("not-ready");
						}),
						{ interval: "1 millis", times },
					),
				);
				expect(exit).toEqual(Exit.fail("not-ready"));
				expect(attempts).toBe(times + 1);
			}
		},
		{ clock },
	);

	effectApp(
		`does not retry thrown assertions under the ${clock} clock`,
		function* () {
			let attempts = 0;
			const exit = yield* Effect.exit(
				eventually(
					Effect.sync(() => {
						attempts += 1;
						expect(attempts).toBe(3);
					}),
					{ interval: "1 millis", times: 3 },
				),
			);
			expect(Exit.isFailure(exit) && Cause.hasDies(exit.cause)).toBe(true);
			expect(attempts).toBe(1);
		},
		{ clock },
	);

	effectApp(
		`retries assertions explicitly captured with Effect.try under the ${clock} clock`,
		function* () {
			let attempts = 0;
			yield* eventually(
				Effect.try(() => {
					attempts += 1;
					expect(attempts).toBe(3);
				}),
				{ interval: "1 millis", times: 3 },
			);
			expect(attempts).toBe(3);
		},
		{ clock },
	);

	effectApp(
		`preserves interruption under the ${clock} clock`,
		function* () {
			let attempts = 0;
			const exit = yield* Effect.exit(
				eventually(
					Effect.suspend(() => {
						attempts += 1;
						return Effect.interrupt;
					}),
					{ interval: "1 millis", times: 3 },
				),
			);
			expect(Exit.isFailure(exit) && Cause.hasInterrupts(exit.cause)).toBe(true);
			expect(attempts).toBe(1);
		},
		{ clock },
	);
}

class AcquiredAt extends Context.Service<AcquiredAt, number>()("@test/AcquiredAt") {}

const acquisitionIt = makeEffectIt({
	layer: Layer.effect(AcquiredAt, Clock.currentTimeMillis),
	makeHarness: () => Clock.currentTimeMillis,
});

acquisitionIt.effectApp("acquires the worker Layer with live time and the harness with test time", function* (harnessTime) {
	expect(yield* AcquiredAt).toBeGreaterThan(1_000_000);
	expect(harnessTime).toBe(0);
	expect(yield* Clock.currentTimeMillis).toBe(0);
});
