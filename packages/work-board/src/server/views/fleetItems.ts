import { Effect } from "effect";
import { waitsOnYou } from "#browser/document/asks.ts";
import type { AuthoredProgress, FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { heldLanes, laneOf } from "#browser/views/now.ts";
import { DAEMON_PORT } from "#diagnostics/daemonContract.ts";
import { inboxItems } from "#server/attention/inbox.ts";
import { requestInbox } from "#server/attention/requestInbox.ts";
import { daemonUnavailable, readDaemon } from "#server/diagnostics/daemon.ts";
import { itemRequests } from "#server/document/requests.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { itemsOf } from "#server/views/items.ts";
import { mergeWaits } from "#server/views/mergeWaits.ts";
import { Workspace } from "#server/workspace.ts";

function authoredProgress(snapshot: Snapshot): readonly AuthoredProgress[] {
	const waiting = new Set(inboxItems(snapshot).flatMap((entry) => (entry.problem ? [] : [entry.id])));
	const answered = new Set(requestInbox(snapshot).answered.map((entry) => entry.id));
	return itemsOf(snapshot).flatMap(({ document, id, title }) => {
		const metadata = document.parsed.fields;
		const asked = waitsOnYou({ metadata, requests: itemRequests(document, snapshot).map((request) => request.state) });
		const lane = laneOf(metadata, undefined, false, answered.has(id) && !waiting.has(id), asked);
		return lane !== undefined && heldLanes.has(lane) && metadata.status !== undefined
			? [{ file: document.file, status: metadata.status, title, workId: id }]
			: [];
	});
}

const fleetItemsUnavailable = Effect.fn("WorkBoard.fleetItemsUnavailable")(function* (unavailable: {
	readonly reason: string;
	readonly startCommand?: string;
}) {
	const workspace = yield* Workspace;
	const snapshot = yield* workspace.index().pipe(Effect.catch(() => Effect.succeed(undefined)));
	const projection: FleetItemsProjection =
		snapshot && snapshot.unavailable.length === 0
			? { ...unavailable, authored: authoredProgress(snapshot), state: "unavailable" }
			: { ...unavailable, state: "unavailable" };
	return projection;
});

export function fleetItems(folder: string, fleetPort: number | null = DAEMON_PORT): Effect.Effect<FleetItemsProjection, never, Workspace> {
	if (fleetPort === null) {
		return fleetItemsUnavailable({ reason: "Fleet isn't set up for this Board." });
	}
	return Effect.gen(function* () {
		const result = yield* readDaemon(fleetPort, (client) => client("daemon.fleetItems", {})).pipe(Effect.result);
		const workspace = yield* Workspace;
		if (result._tag === "Failure") {
			return yield* fleetItemsUnavailable(daemonUnavailable(result.failure, fleetPort, folder));
		}
		const data = result.success;
		const snapshot = yield* workspace.index().pipe(Effect.catch(() => Effect.succeed(undefined)));
		if (!snapshot) {
			return { reason: "Board documents could not be read for Fleet items", state: "unavailable" as const };
		}
		const documents = new Map(
			itemsOf(snapshot).map(({ id, document, title }) => [id, { file: document.file, metadata: document.parsed.fields, title }]),
		);
		const ready = mergeWaits(snapshot);
		return {
			completed: data.completed.map((item) => ({ ...item, document: documents.get(item.workId) ?? null })),
			items: data.items.map((item) => ({
				...item,
				document: documents.get(item.workId) ?? null,
				...(item.stage === "needs-human" && item.attentionOwner === "maintainer" && ready.has(item.workId) ? { readyToMerge: true } : {}),
			})),
			state: "ready" as const,
		};
	});
}
