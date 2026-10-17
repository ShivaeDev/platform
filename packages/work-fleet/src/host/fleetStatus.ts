import { Effect, Schema } from "effect";
import { views } from "#engine/views.ts";
import type { FleetHost } from "#host/config.ts";
import { recordPayloads } from "#host/recordPayloads.ts";
import { FleetRecord } from "#model.ts";
import { dispatchStore } from "#storage/dispatchStore.ts";

export const fleetStatus = Effect.fn("FleetHost.fleetStatus")(function* (host: FleetHost, workId?: string) {
	const payloads = yield* recordPayloads(host.namespace, workId);
	const records = yield* Effect.forEach(payloads, (payload) => Schema.decodeUnknownEffect(Schema.fromJsonString(FleetRecord))(payload));
	const requests = yield* (yield* dispatchStore(host.namespace)).list(workId);
	const dispatches = requests.filter((request) => request.status !== "completed");
	return dispatches.length === 0 ? views(records) : { ...views(records), dispatches };
});
