import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { running } from "#test/postgres/traits.ts";

const Notes = defineQueue({ name: "notes", schema: Schema.Struct({ id: Schema.NumberFromString }) });

for (const [reason, options] of [
	["its lifetime", { idleTimeoutMillis: 0, maxLifetimeSeconds: 1 }],
	["being idle", { idleTimeoutMillis: 100, maxLifetimeSeconds: 0 }],
] as const) {
	database.it(
		`a jobs backend closes after ${reason} and a subsequent enqueue succeeds on a replacement`,
		[running("app", [Notes], { ...options, controller: "none", max: 1, schedule: false, supervise: false })],
		function* ({ answered, backendIsConnected, backendPid, enqueue, untilBackendDisconnects }) {
			const before = yield* backendPid("app");
			expect(yield* backendIsConnected(before)).toBe(true);

			yield* untilBackendDisconnects(before);

			expect(yield* backendIsConnected(before)).toBe(false);
			yield* enqueue("app", Notes, { id: 1 }, { as: "note 1" });
			yield* outcomes([
				["job answer", () => answered(), "note 1"],
				["backend replaced", () => Effect.map(backendPid("app"), (pid) => pid !== before), true],
			]);
		},
	);
}
