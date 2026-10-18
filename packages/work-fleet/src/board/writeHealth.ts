import { Effect, Schema } from "effect";
import type { FleetHealth as BoardFleetHealth } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { writePublished } from "#board/writePublished.ts";
import { BoardFailure } from "#policy.ts";

const { FLEET_HEALTH_NAME, FleetHealth } = diagnosticsApi;

export function writeHealth(root: string, realRoot: string, snapshot: BoardFleetHealth) {
	const Json = Schema.fromJsonString(FleetHealth);
	const Previous = Schema.fromJsonString(
		Schema.Struct({
			concurrency: FleetHealth.fields.concurrency,
			lastCapacityRejection: FleetHealth.fields.lastCapacityRejection,
			lastSchedulerPass: FleetHealth.fields.lastSchedulerPass,
			observedAt: FleetHealth.fields.observedAt,
			queued: FleetHealth.fields.queued,
			running: FleetHealth.fields.running,
			staleAfterMs: FleetHealth.fields.staleAfterMs,
			version: Schema.Literal(1),
		}),
	);
	return writePublished(
		root,
		realRoot,
		FLEET_HEALTH_NAME,
		`${Schema.encodeSync(Json)(snapshot)}\n`,
		(source) => Schema.decodeUnknownOption(Json)(source)._tag === "Some" || Schema.decodeUnknownOption(Previous)(source)._tag === "Some",
	).pipe(Effect.mapError((error) => new BoardFailure({ message: error.message })));
}
