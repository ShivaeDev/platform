import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { Conflict } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { DecisionCode } from "#DecisionCode.ts";
import { fleetRecords } from "#fleetRecords.ts";
import type { Decision, DecisionResponse } from "#policy.ts";
import { makeFleetTransaction } from "#storage/makeFleetTransaction.ts";

class AnswerRow extends Model.Class<AnswerRow>("FleetAnswer")({
	"decision_code": Schema.NullOr(DecisionCode),
	"decision_id": Schema.NullOr(Schema.String),
	"decision_reason": Schema.String,
	error: Schema.NullOr(Schema.String),
	position: Model.GeneratedByDb(Schema.Number),
	release: Schema.Boolean,
	"request_id": Schema.String,
	"response_decision_id": Schema.NullOr(Schema.String),
	"response_id": Schema.NullOr(Schema.String),
	text: Schema.String,
	"work_id": Schema.String,
}) {}

export const answerStore = Effect.fn("FleetAnswer.answerStore")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	const commit = yield* makeFleetTransaction;
	const repository = yield* makeRepository(AnswerRow, {
		idColumn: "request_id",
		spanPrefix: "FleetAnswer",
		tableName: `${namespace}_answers`,
	});
	function list(workId?: string) {
		return repository.findMany({ orderBy: { direction: "asc", field: "position" }, where: { "work_id": workId } });
	}
	function locked<A, E, R>(workId: string, effect: Effect.Effect<A, E, R>) {
		return commit(
			[fleetRecords.list, fleetRecords.item(workId)],
			sql`select pg_advisory_xact_lock(hashtextextended(${`${namespace}:answer:${workId}`}, 0))`.pipe(Effect.andThen(effect)),
		);
	}
	return {
		accept: Effect.fn("FleetAnswer.accept")(function* (workId: string, decision: Decision | undefined, text: string, release: boolean) {
			return yield* locked(
				workId,
				Effect.gen(function* () {
					const current = (yield* list(workId))[0];
					if (current !== undefined && current.error === null && (decision !== undefined || current.decision_id !== null)) {
						if (current.decision_id !== decision?.id || current.text !== text || current.release !== release) {
							return yield* new Conflict({ message: "An answer is already recorded; check status before answering again" });
						}
						return current;
					}
					if (current !== undefined && current.error !== null) {
						yield* repository.delete(current.request_id);
					}
					return yield* repository.insert(answerInput(workId, decision, text, release));
				}),
			);
		}),
		finish: (request: AnswerRow, error?: string) =>
			locked(
				request.work_id,
				Effect.gen(function* () {
					const current = (yield* list(request.work_id)).find((row) => row.request_id === request.request_id);
					if (current === undefined) {
						return;
					}
					yield* error === undefined ? repository.delete(request.request_id) : repository.updateVoid({ ...current, error });
				}),
			),
		list,
		recordResponse: (request: AnswerRow, response: Pick<DecisionResponse, "decisionId" | "responseId">) =>
			locked(
				request.work_id,
				Effect.gen(function* () {
					const current = (yield* list(request.work_id)).find((row) => row.request_id === request.request_id);
					if (current === undefined) {
						return yield* new Conflict({ message: "The recorded answer request changed before application" });
					}
					yield* repository.updateVoid({ ...current, "response_decision_id": response.decisionId, "response_id": response.responseId });
				}),
			),
	};
});

export type AnswerRequest = AnswerRow;

function answerInput(workId: string, decision: Decision | undefined, text: string, release: boolean) {
	return {
		"decision_code": decision?.code ?? null,
		"decision_id": decision?.id ?? null,
		"decision_reason": decision?.reason ?? "",
		error: null,
		release,
		"request_id": crypto.randomUUID(),
		"response_decision_id": null,
		"response_id": null,
		text,
		"work_id": workId,
	};
}
