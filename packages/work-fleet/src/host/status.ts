import { Effect, Schema } from "effect";
import { views } from "#engine/views.ts";
import type { FleetHost } from "#host/config.ts";
import { recordPayloads } from "#host/recordPayloads.ts";
import { FleetRecord, type FleetViews } from "#model.ts";
import { renderStatus as render } from "./renderStatus.ts";

export function renderStatus(current: typeof FleetViews.Type) {
	return render(current);
}

export const fleetStatus = Effect.fn("FleetHost.fleetStatus")(function* (host: FleetHost, workId?: string) {
	const payloads = yield* recordPayloads(host.namespace, workId);
	const records = yield* Effect.forEach(payloads, (payload) => Schema.decodeUnknownEffect(Schema.fromJsonString(FleetRecord))(payload));
	return views(records);
});
