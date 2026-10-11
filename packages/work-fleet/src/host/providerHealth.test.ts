import { expect } from "@effect/vitest";
import { Effect, Layer, Ref } from "effect";
import { TestClock } from "effect/testing";
import { it } from "@shivaedev/effect-test/it.ts";
import { Health, type HealthState } from "#engine/health.ts";
import { SessionTransport } from "#session/service.ts";
import { capacityTransport } from "#test/capacityTransport.ts";
import { providerHealth } from "./providerHealth.ts";

it.effect("retains explicit rejection causes without changing provider failures and ignores unrelated rejections", function* () {
	const state = yield* Ref.make<HealthState>({ lastCapacityRejection: null, lastSchedulerPass: null });
	for (const explicit of [false, true]) {
		yield* Effect.gen(function* () {
			const transport = yield* SessionTransport;
			const error = yield* transport.startSession({ cwd: "/synthetic", operationId: "synthetic", prompt: "Synthetic" }).pipe(Effect.flip);
			expect(error.reason).toBe("rejected");
			expect((yield* Ref.get(state)).lastCapacityRejection).toEqual(explicit ? { at: 0, cause: "Synthetic capacity rejection" } : null);
		}).pipe(
			Effect.provide(
				providerHealth.pipe(Layer.provide(Layer.merge(Layer.succeed(SessionTransport)(capacityTransport(explicit)), Layer.succeed(Health)(state)))),
			),
		);
	}
});

it.effect("records a terminal capacity failure once rather than refreshing its timestamp on each poll", function* () {
	const state = yield* Ref.make<HealthState>({ lastCapacityRejection: null, lastSchedulerPass: null });
	yield* Effect.gen(function* () {
		const transport = yield* SessionTransport;
		const receipt = { sessionId: "synthetic-session", turnId: "synthetic-turn" };
		yield* transport.observe(receipt);
		const first = (yield* Ref.get(state)).lastCapacityRejection;
		expect(first?.cause).toBe("Synthetic terminal capacity");
		yield* TestClock.adjust("1 minute");
		yield* transport.observe(receipt);
		expect((yield* Ref.get(state)).lastCapacityRejection).toEqual(first);
	}).pipe(
		Effect.provide(
			providerHealth.pipe(Layer.provide(Layer.merge(Layer.succeed(SessionTransport)(capacityTransport(true)), Layer.succeed(Health)(state)))),
		),
	);
});
