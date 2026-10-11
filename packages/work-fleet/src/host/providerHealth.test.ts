import { expect } from "@effect/vitest";
import { Effect, Layer, Ref } from "effect";
import { TestClock } from "effect/testing";
import { it } from "@shivaedev/effect-test/it.ts";
import { Health, type HealthState } from "#engine/health.ts";
import { SessionTransport } from "#session/service.ts";
import { capacityTransport } from "#test/capacityTransport.ts";
import { providerHealth } from "./providerHealth.ts";

it.effect("retains structured rejection codes without changing provider failures and ignores unrelated rejections", function* () {
	const state = yield* Ref.make<HealthState>({ lastCapacityRejection: null, lastSchedulerPass: null });
	for (const explicit of [false, true]) {
		yield* Effect.gen(function* () {
			const transport = yield* SessionTransport;
			const error = yield* transport.startSession({ cwd: "/synthetic", operationId: "synthetic", prompt: "Synthetic" }).pipe(Effect.flip);
			expect(error.reason).toBe("rejected");
			expect((yield* Ref.get(state)).lastCapacityRejection).toEqual(explicit ? { at: 0, cause: "serverOverloaded" } : null);
		}).pipe(
			Effect.provide(
				providerHealth.pipe(Layer.provide(Layer.merge(Layer.succeed(SessionTransport)(capacityTransport(explicit)), Layer.succeed(Health)(state)))),
			),
		);
	}
});

it.effect("bounds terminal rejection history while retaining recent observations", function* () {
	const state = yield* Ref.make<HealthState>({ lastCapacityRejection: null, lastSchedulerPass: null });
	const transport = {
		...capacityTransport(true),
		observe: (receipt: { readonly sessionId: string; readonly turnId: string }) =>
			Effect.succeed({
				capacity: "serverOverloaded" as const,
				error: "Private upstream text",
				execution: "failed" as const,
				output: "",
				provisioning: "ready" as const,
				receipt,
			}),
	};
	yield* Effect.gen(function* () {
		const observed = yield* SessionTransport;
		for (let index = 0; index <= 1024; index += 1) {
			yield* observed.observe({ sessionId: "synthetic", turnId: String(index) });
		}
		const first = (yield* Ref.get(state)).lastCapacityRejection;
		yield* TestClock.adjust("1 minute");
		yield* observed.observe({ sessionId: "synthetic", turnId: "1024" });
		expect((yield* Ref.get(state)).lastCapacityRejection).toEqual(first);
		yield* observed.observe({ sessionId: "synthetic", turnId: "0" });
		expect((yield* Ref.get(state)).lastCapacityRejection).toEqual({ at: 60_000, cause: "serverOverloaded" });
	}).pipe(Effect.provide(providerHealth.pipe(Layer.provide(Layer.merge(Layer.succeed(SessionTransport)(transport), Layer.succeed(Health)(state))))));
});

it.effect("records a terminal capacity failure once rather than refreshing its timestamp on each poll", function* () {
	const state = yield* Ref.make<HealthState>({ lastCapacityRejection: null, lastSchedulerPass: null });
	yield* Effect.gen(function* () {
		const transport = yield* SessionTransport;
		const receipt = { sessionId: "synthetic-session", turnId: "synthetic-turn" };
		yield* transport.observe(receipt);
		const first = (yield* Ref.get(state)).lastCapacityRejection;
		expect(first?.cause).toBe("serverOverloaded");
		yield* TestClock.adjust("1 minute");
		yield* transport.observe(receipt);
		expect((yield* Ref.get(state)).lastCapacityRejection).toEqual(first);
	}).pipe(
		Effect.provide(
			providerHealth.pipe(Layer.provide(Layer.merge(Layer.succeed(SessionTransport)(capacityTransport(true)), Layer.succeed(Health)(state)))),
		),
	);
});
