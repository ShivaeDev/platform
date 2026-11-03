import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { FleetItems } from "#diagnostics/fleetItems.ts";
import { boardStory } from "#test/boardStory.ts";
import { rawDiagnosticsDaemon } from "#test/diagnosticsDaemon.ts";

export function unavailableBriefValidation(items: FleetItems = { completed: [], items: [] }) {
	return boardStory.trait("project", "Fleet can report its items but cannot validate briefs", function* (engine) {
		const daemon = yield* rawDiagnosticsDaemon(
			() => ({}),
			0,
			() => items,
			Effect.fail(new ServiceUnavailable({ message: "Fleet brief validation is unavailable" })),
		);
		engine.fleetPort = daemon.port;
	});
}
