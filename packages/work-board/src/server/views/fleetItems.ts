import { Effect } from "effect";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { DAEMON_PORT } from "#diagnostics/daemonContract.ts";
import { daemonUnavailable, readDaemon } from "#server/diagnostics/daemon.ts";
import { itemsOf } from "#server/views/items.ts";
import { Workspace } from "#server/workspace.ts";

export function fleetItems(fleetPort: number | null = DAEMON_PORT): Effect.Effect<FleetItemsProjection, never, Workspace> {
	if (fleetPort === null) {
		return Effect.succeed({ reason: "Fleet daemon is not configured for this Board", state: "unavailable" });
	}
	return Effect.gen(function* () {
		const result = yield* readDaemon(fleetPort, (client) => client("daemon.fleetItems", {})).pipe(Effect.result);
		const workspace = yield* Workspace;
		if (result._tag === "Failure") {
			const { root } = yield* workspace.settings();
			return { ...daemonUnavailable(result.failure, fleetPort, root), state: "unavailable" as const };
		}
		const data = result.success;
		const snapshot = yield* workspace.index().pipe(Effect.catch(() => Effect.succeed(undefined)));
		if (!snapshot) {
			return { reason: "Board documents could not be read for Fleet items", state: "unavailable" as const };
		}
		const documents = new Map(
			itemsOf(snapshot).map(({ id, document, title }) => [id, { file: document.file, metadata: document.parsed.fields, title }]),
		);
		return {
			completed: data.completed.map((item) => ({ ...item, document: documents.get(item.workId) ?? null })),
			items: data.items.map((item) => ({ ...item, document: documents.get(item.workId) ?? null })),
			state: "ready" as const,
		};
	});
}
