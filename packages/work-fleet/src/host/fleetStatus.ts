import { Effect, Schema, Struct } from "effect";
import { SqlClient } from "effect/sql";
import { newestCompletion, RECENT_COMPLETED, views } from "#engine/views.ts";
import { answerRecords, withAnswerRequests } from "#host/answerRecords.ts";
import type { FleetHost } from "#host/config.ts";
import { Attempt, FleetRecord } from "#model.ts";
import { Decision } from "#policy.ts";
import { answerStore } from "#storage/answerStore.ts";
import { dispatchStore } from "#storage/dispatchStore.ts";
import { readRecordSnapshot } from "#storage/readRecords.ts";
import { schemaShape, shapeColumns } from "#storage/recordShape.ts";
import { recordValues } from "#storage/recordValue.ts";

export const fleetStatus = Effect.fn("FleetHost.fleetStatus")(function* (host: FleetHost, workId?: string) {
	if (workId !== undefined) {
		const records = yield* answerRecords(host.namespace, workId);
		const dispatches = (yield* (yield* dispatchStore(host.namespace)).list(workId)).filter((request) => request.status !== "completed");
		return { ...views(records), ...(dispatches.length === 0 ? {} : { dispatches }), record: records[0] };
	}
	const records = yield* statusRecords(host.namespace);
	const requests = yield* (yield* dispatchStore(host.namespace)).list(workId);
	const dispatches = requests.filter((request) => request.status !== "completed");
	return {
		...views(records),
		...(dispatches.length === 0 ? {} : { dispatches }),
	};
});

const StatusRecord = Schema.Struct({
	...Struct.pick(FleetRecord.fields, ["attentionOwner", "blocker", "completedAt", "outcome", "result", "step", "updatedAt", "workId"]),
	attempts: Schema.Array(
		Schema.Struct(Struct.pick(Attempt.fields, ["briefSteers", "overLimit", "progress", "publishedRecovery", "receipt", "stallRecovery", "status"])),
	),
	checks: Schema.optional(Schema.Struct({ pending: Schema.optional(Schema.Boolean) })),
	decision: Schema.optional(Schema.Struct(Struct.omit(Decision.fields, ["publicationWork", "published"]))),
	launchRetry: Schema.optional(Schema.Struct({ rejectedAt: Schema.Number, rejections: Schema.Number, retryAt: Schema.Number })),
	report: Schema.optional(Schema.Struct({ sourcePath: Schema.String })),
});

const shape = schemaShape(StatusRecord);
const columns = Object.keys(shapeColumns(shape)).filter((name) => name !== "workId");

const statusRecords = Effect.fn("FleetHost.statusRecords")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	return yield* readRecordSnapshot(
		Effect.gen(function* () {
			const rows =
				yield* sql`select ${sql.csv([...columns, "work_id"].map((name) => sql`${sql(name)}`))} from ${sql(`${namespace}_records`)} order by work_id`;
			const requests = yield* (yield* answerStore(namespace)).list();
			const pending = new Set(requests.map((request) => request.work_id));
			const selected = rows.filter(
				(row) =>
					!["done", "released"].includes(String(row.step)) || row.blocker !== null || row.launchRetry !== null || pending.has(String(row.work_id)),
			);
			const selectedIds = new Set(selected.map((row) => row.work_id));
			const finished = rows
				.filter((row) => row.step === "done" && !selectedIds.has(row.work_id))
				.sort(newestCompletion((row) => String(row.work_id)))
				.slice(0, RECENT_COMPLETED);
			const records = yield* Schema.decodeUnknownEffect(Schema.Array(StatusRecord))(
				yield* recordValues([...selected, ...finished], shape, namespace),
			);
			return withAnswerRequests(records, requests);
		}),
	);
});
