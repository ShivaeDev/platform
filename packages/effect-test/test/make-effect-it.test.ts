import { expect } from "@effect/vitest";
import { Cause, Clock, Context, Effect, Exit, Layer } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { eventually, makeEffectIt } from "../src/index.ts";

class Token extends Context.Service<Token, string>()("@test/Token") {}

const aroundLog: string[] = [];

const { effectApp } = makeEffectIt({
	layer: Layer.succeed(Token, "from-layer"),
	around: (effect) =>
		Effect.gen(function* () {
			aroundLog.push("enter");
			const value = yield* effect;
			aroundLog.push("exit");
			return value;
		}),
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
	expect(yield* Clock.currentTimeMillis).toBe(1_000);
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

let aroundRan = false;
const aroundIt = makeEffectIt({
	layer: Layer.succeed(Token, "from-layer"),
	around: (effect) =>
		Effect.gen(function* () {
			aroundRan = true;
			return yield* effect;
		}),
	makeHarness: () => Effect.succeed({ ok: true as const }),
});

aroundIt.effectApp("applies the around hook before the generator body", function* (harness) {
	expect(aroundRan).toBe(true);
	expect(harness.ok).toBe(true);
	return yield* Effect.void;
});

effectApp.each(["alpha", "beta"])("passes table cases to the generator for %s", function* (item, harness) {
	expect(["alpha", "beta"]).toContain(item);
	expect(harness.token).toBe("from-layer");
	return yield* Effect.void;
});

effectApp("retries through TestClock.adjust", function* () {
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
		{ interval: "10 millis" },
	);

	expect(value).toBe(50);
	expect(seen).toEqual([0, 10, 20, 30, 40, 50]);
	expect(yield* Clock.currentTimeMillis).toBe(50);
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
