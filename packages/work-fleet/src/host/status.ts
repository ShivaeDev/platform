import { Effect, Schema } from "effect";
import { views } from "#engine/views.ts";
import type { FleetHost } from "#host/config.ts";
import { recordPayloads } from "#host/readOnlySql.ts";
import { FleetRecord, type FleetViews } from "#model.ts";

type View = (typeof FleetViews.Type)["active"][number];

export const fleetStatus = Effect.fn("FleetHost.fleetStatus")(function* (host: FleetHost, workId?: string) {
	const payloads = yield* recordPayloads(host.namespace, workId);
	const records = yield* Effect.forEach(payloads, (payload) => Schema.decodeUnknownEffect(Schema.fromJsonString(FleetRecord))(payload));
	return views(records);
});

function line(view: View) {
	const detail = view.blocker === undefined ? "" : `  ${view.blocker}`;
	const links = [...view.links, ...view.sessions.map((session) => `session ${session.sessionId} turn ${session.turnId}`)];
	return `  ${view.workId}  ${view.stage}${detail}${links.length === 0 ? "" : `  (${links.join(", ")})`}`;
}

export function renderStatus(current: typeof FleetViews.Type): string {
	const sections: readonly [string, readonly View[]][] = [
		["Active", current.active],
		["Needs human", current.needsHuman],
		["Completed", current.completed],
	];
	return sections.map(([title, items]) => [`${title} (${items.length})`, ...items.map(line)].join("\n")).join("\n");
}
