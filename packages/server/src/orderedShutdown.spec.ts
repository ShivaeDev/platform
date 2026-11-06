import { expect } from "vitest";
import { atMost } from "@shivaedev/test-story/server/adapters/outcomeMatchers.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { orderedShutdownHost, stalledCollector } from "#test/app-host/orderedShutdownStory.ts";
import { DRAINING_MILLIS } from "#test/app-host/ShutdownApi.ts";

for (const [collector, traits] of [
	["responsive", []],
	["stalled", [stalledCollector]],
] as const) {
	orderedShutdownHost.it(
		`SIGTERM drains WebSockets, PostgreSQL and the ${collector} exporter in order, exporting the drain span within the budget`,
		traits,
		function* ({ exportedDrainSpans, finalizers, launch, openWebSocket, shutdownDuration, sigterm }) {
			yield* launch();
			yield* openWebSocket();
			expect(yield* finalizers()).toEqual([]);

			yield* sigterm();

			yield* outcomes([
				["finalizer completion order", () => finalizers(), ["WebSockets", "database", "exporter"]],
				["drain spans received by the collector", () => exportedDrainSpans(), ["websocket drain"]],
				["shutdown duration in milliseconds", () => shutdownDuration(), atMost(DRAINING_MILLIS)],
			]);
		},
	);
}
