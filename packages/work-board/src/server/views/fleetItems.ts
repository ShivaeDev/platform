import { join } from "node:path";
import { Effect } from "effect";
import { waitsOnYou } from "#browser/document/asks.ts";
import type { AuthoredProgress, FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { laneOf } from "#browser/views/now.ts";
import { DAEMON_PORT } from "#diagnostics/daemonContract.ts";
import { inboxItems } from "#server/attention/inbox.ts";
import { requestInbox } from "#server/attention/requestInbox.ts";
import { daemonUnavailable, readDaemon } from "#server/diagnostics/daemon.ts";
import { fleetChecksBrief } from "#server/document/briefDiagnostic.ts";
import { itemRequests } from "#server/document/requests.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { fleetAgents } from "#server/views/fleetAgents.ts";
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
		return metadata.status === "ready" && lane !== undefined ? [{ file: document.file, status: metadata.status, title, workId: id }] : [];
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
		const settings = yield* workspace.settings();
		const briefs = [...new Set([...data.completed, ...data.items].map((item) => item.workId))].flatMap((workId) => {
			const matches = snapshot.model.ids.get(workId);
			const document = matches?.length === 1 ? matches[0] : undefined;
			return document !== undefined && fleetChecksBrief(document.parsed.fields.kind, document.parsed.fields.status)
				? [{ sourcePath: join(settings.realRoot, document.file), workId }]
				: [];
		});
		// One request covers the whole view: a request per brief kept views with many Fleet items waiting past client timeouts.
		const refusals =
			briefs.length === 0
				? []
				: yield* readDaemon(fleetPort, (client) => client("daemon.briefProblems", { briefs })).pipe(Effect.catch(() => Effect.succeed([])));
		const refused = new Set(refusals.map((refusal) => refusal.workId));
		const ready = mergeWaits(snapshot);
		return {
			completed: data.completed
				.filter((item) => !refused.has(item.workId))
				.map((item) => ({ ...item, document: documents.get(item.workId) ?? null })),
			items: data.items
				.filter((item) => !refused.has(item.workId))
				.map((item) => ({
					...item,
					...fleetAgents(item),
					document: documents.get(item.workId) ?? null,
					...(item.stage === "waiting" && item.attentionOwner === "maintainer" && ready.has(item.workId) ? { readyToMerge: true } : {}),
				})),
			state: "ready" as const,
		};
	});
}
