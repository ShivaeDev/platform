import { Schema } from "effect";
import { FLEET_HEALTH_NAME, FleetHealth } from "@shivaedev/work-board/diagnostics/health.ts";
import { writePublished } from "#board/writePublished.ts";

export function writeHealth(root: string, realRoot: string, snapshot: FleetHealth) {
	const Json = Schema.fromJsonString(FleetHealth);
	return writePublished(
		root,
		realRoot,
		FLEET_HEALTH_NAME,
		`${Schema.encodeSync(Json)(snapshot)}\n`,
		(source) => Schema.decodeUnknownOption(Json)(source)._tag === "Some",
	);
}
