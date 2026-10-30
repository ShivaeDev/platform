import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { database } from "#test/postgres/database.ts";
import { disconnectGated, runningBehindGate } from "#test/postgres/traits.ts";

for (const { client, controller } of [
	{ client: "default", controller: "none" },
	{ client: "testing", controller: "production retries" },
] as const) {
	database.it(
		`stopping a runtime on the ${client} client waits until PostgreSQL acknowledges every disconnect`,
		[disconnectGated, runningBehindGate("app", { controller })],
		function* ({ backends, releaseDisconnects, shutdown, stopInBackground, untilDisconnectsHeld, untilStopped }) {
			expect(yield* backends("app")).toBeGreaterThan(0);

			yield* stopInBackground("app");
			yield* untilDisconnectsHeld();

			yield* outcomes({
				"open backends": [backends("app"), 0],
				"shutdown": [shutdown("app"), "still stopping"],
			});

			yield* releaseDisconnects();
			yield* untilStopped("app");

			expect(yield* shutdown("app")).toBe("stopped");
		},
	);
}
