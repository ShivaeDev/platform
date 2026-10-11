import { Schema } from "effect";
import { FLEET_HEALTH_NAME, FleetHealth } from "@shivaedev/work-board/diagnostics/health.ts";
import { writePublished } from "#board/writePublished.ts";

export function writeHealth(root: string, realRoot: string, snapshot: FleetHealth) {
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
	);
}
