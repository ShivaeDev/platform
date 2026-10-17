import { Effect, Schema } from "effect";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { views } from "#engine/views.ts";
import type { FleetHost } from "#host/config.ts";
import { FleetRecord } from "#model.ts";
import { dispatchStore } from "#storage/dispatchStore.ts";
import { recordModel } from "#storage/model.ts";
import { readRecords } from "#storage/readRecords.ts";
import { recordShape } from "#storage/recordShape.ts";
import { recordValues } from "#storage/recordValue.ts";

export const fleetStatus = Effect.fn("FleetHost.fleetStatus")(function* (host: FleetHost, workId?: string) {
	const repository = yield* makeRepository(recordModel(), {
		idColumn: "work_id",
		spanPrefix: "FleetReader",
		tableName: `${host.namespace}_records`,
	});
	const records = yield* readRecords(
		host.namespace,
		Effect.gen(function* () {
			const rows = yield* repository.findMany({ orderBy: { direction: "asc", field: "work_id" }, where: { "work_id": workId } });
			return yield* Schema.decodeUnknownEffect(Schema.Array(FleetRecord))(yield* recordValues(rows, recordShape(), host.namespace));
		}),
	);
	const requests = yield* (yield* dispatchStore(host.namespace)).list(workId);
	const dispatches = requests.filter((request) => request.status !== "completed");
	return dispatches.length === 0 ? views(records) : { ...views(records), dispatches };
});
