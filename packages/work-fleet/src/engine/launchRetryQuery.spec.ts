import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

postgresTests("live")("the retry projection sees another writer queue and clear work without restarting the reader", () =>
	withEngine({}, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			const prepared = yield* prepareWork("one");
			expect(yield* fleet.hasLaunchRetry()).toBe(false);
			yield* fixture.replaceRecord({ ...prepared.value, launchRetry: { rejectedAt: 100, rejections: 1, retryAt: 30_100 } });
			expect(yield* fleet.hasLaunchRetry()).toBe(true);
			expect(yield* fixture.restart(Effect.flatMap(Fleet, (restarted) => restarted.hasLaunchRetry()))).toBe(true);
			yield* fixture.replaceRecord(prepared.value);
			expect(yield* fleet.hasLaunchRetry()).toBe(false);
		}),
	),
);
