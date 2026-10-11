import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Effect, Ref } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { writeHealth } from "#board/writeHealth.ts";
import { Health } from "#engine/health.ts";
import { healthFolder, healthSnapshot } from "#test/health.ts";
import { healthLayer } from "./healthLayer.ts";

it.effect("reloads scheduler and capacity observations after a host restart", () =>
	Effect.gen(function* () {
		const folder = yield* healthFolder();
		yield* writeHealth(folder.root, folder.root, healthSnapshot);
		const restored = yield* Effect.flatMap(Health, Ref.get).pipe(Effect.provide(healthLayer(folder.root)));
		expect(restored).toEqual({ lastCapacityRejection: healthSnapshot.lastCapacityRejection, lastSchedulerPass: healthSnapshot.lastSchedulerPass });
	}).pipe(Effect.provide(NodeServices.layer)),
);

it.effect("does not republish legacy raw provider text after restart", () =>
	Effect.gen(function* () {
		const folder = yield* healthFolder();
		yield* writeHealth(folder.root, folder.root, { ...healthSnapshot, lastCapacityRejection: { at: 800, cause: "Private upstream text" } });
		const restored = yield* Effect.flatMap(Health, Ref.get).pipe(Effect.provide(healthLayer(folder.root)));
		expect(restored).toEqual({ lastCapacityRejection: null, lastSchedulerPass: healthSnapshot.lastSchedulerPass });
	}).pipe(Effect.provide(NodeServices.layer)),
);
