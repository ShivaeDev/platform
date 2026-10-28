import { Effect, Schema } from "effect";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { ANSWER_RECORDED } from "#attention.ts";
import { FleetRecord } from "#model.ts";
import { type AnswerRequest, answerStore } from "#storage/answerStore.ts";
import { recordModel } from "#storage/model.ts";
import { readRecordSnapshot } from "#storage/readRecords.ts";
import { recordShape } from "#storage/recordShape.ts";
import { recordValues } from "#storage/recordValue.ts";

export const answerRecords = Effect.fn("FleetHost.answerRecords")(function* (namespace: string, workId?: string) {
	const repository = yield* makeRepository(recordModel(), { idColumn: "work_id", spanPrefix: "FleetReader", tableName: `${namespace}_records` });
	return yield* readRecordSnapshot(
		Effect.gen(function* () {
			const rows = yield* repository.findMany({ orderBy: { direction: "asc", field: "work_id" }, where: { "work_id": workId } });
			const records = yield* Schema.decodeUnknownEffect(Schema.Array(FleetRecord))(yield* recordValues(rows, recordShape(), namespace));
			return withAnswerRequests(records, yield* (yield* answerStore(namespace)).list(workId));
		}),
	);
});

export function withAnswerRequests<
	A extends { readonly workId: string; readonly step?: string; readonly stage?: string; readonly launchRetry?: unknown },
>(records: readonly A[], requests: readonly AnswerRequest[]) {
	const byWork = new Map(requests.toReversed().map((request) => [request.work_id, request]));
	return records.map((record) => {
		const request = byWork.get(record.workId);
		if (request === undefined || ["done", "released"].includes(record.step ?? record.stage ?? "")) {
			return record;
		}
		const { launchRetry: _launchRetry, ...current } = record;
		return {
			...current,
			attentionOwner: request.error === null ? ("automation" as const) : ("orchestrator" as const),
			blocker: request.error === null ? ANSWER_RECORDED : `Answer failed: ${request.error}`,
			stage: "waiting" as const,
		};
	});
}
