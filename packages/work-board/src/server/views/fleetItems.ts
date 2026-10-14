import { Effect } from "effect";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { DAEMON_PORT } from "#diagnostics/daemonContract.ts";
import { daemonUnavailableReason, readDaemon } from "#server/diagnostics/daemon.ts";
import type { HandlerOptions } from "#server/rpc/HandlerOptions.ts";
import { itemsOf } from "#server/views/items.ts";

export function fleetItems({ index, fleetPort = DAEMON_PORT }: Pick<HandlerOptions, "index" | "fleetPort">): Effect.Effect<FleetItemsProjection> {
	if (fleetPort === null) {
		return Effect.succeed({ reason: "Fleet daemon is not configured for this Board", state: "unavailable" });
	}
	return Effect.gen(function* () {
		const result = yield* readDaemon(fleetPort, (client) => client("daemon.fleetItems", {})).pipe(Effect.result);
		if (result._tag === "Failure") {
			return { reason: daemonUnavailableReason(result.failure, fleetPort), state: "unavailable" as const };
		}
		const data = result.success;
		const snapshot = yield* index;
		const documents = new Map(
			itemsOf(snapshot).map(({ id, document, title }) => [id, { file: document.file, metadata: document.parsed.fields, title }]),
		);
		return {
			completed: data.completed.map((item) => ({ ...item, document: documents.get(item.workId) ?? null })),
			items: data.items.map((item) => ({ ...item, document: documents.get(item.workId) ?? null })),
			state: "ready" as const,
		};
	}).pipe(Effect.catchCause(() => Effect.succeed({ reason: "Board documents could not be read for Fleet items", state: "unavailable" as const })));
}
