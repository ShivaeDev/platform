import { Clock, Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { Conflict } from "@shivaedev/platform/errors/taxonomy.ts";
import { DecisionCode } from "#DecisionCode.ts";
import { fleetRecords } from "#fleetRecords.ts";
import type { Decision } from "#policy.ts";
import { makeFleetTransaction } from "#storage/makeFleetTransaction.ts";

class AnswerRow extends Model.Class<AnswerRow>("FleetAnswer")({
	"accepted_at": Schema.Number,
	"decision_code": Schema.NullOr(DecisionCode),
	"decision_id": Schema.String,
	"decision_reason": Schema.String,
	error: Schema.NullOr(Schema.String),
	release: Schema.Boolean,
	"request_id": Schema.String,
	text: Schema.String,
	"work_id": Schema.String,
}) {}

export const answerStore = Effect.fn("FleetAnswer.answerStore")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	const commit = yield* makeFleetTransaction;
	const repository = yield* makeRepository(AnswerRow, {
		idColumn: "work_id",
		spanPrefix: "FleetAnswer",
		tableName: `${namespace}_answers`,
	});
	function list(workId?: string) {
		return repository.findMany({ where: { "work_id": workId } });
	}
	function locked<A, E, R>(workId: string, effect: Effect.Effect<A, E, R>) {
		return commit(
			[fleetRecords.list, fleetRecords.item(workId)],
			sql`select pg_advisory_xact_lock(hashtextextended(${`${namespace}:answer:${workId}`}, 0))`.pipe(Effect.andThen(effect)),
		);
	}
	return {
		accept: Effect.fn("FleetAnswer.accept")(function* (workId: string, decision: Decision, text: string, release: boolean) {
			return yield* locked(
				workId,
				Effect.gen(function* () {
					const current = (yield* list(workId))[0];
					if (current !== undefined && current.error === null) {
						if (current.decision_id !== decision.id || current.text !== text || current.release !== release) {
							return yield* new Conflict({ message: "An answer is already recorded; check status before answering again" });
						}
						return current;
					}
					if (current !== undefined) {
						yield* repository.delete(workId);
					}
					return yield* repository.insert({
						"accepted_at": yield* Clock.currentTimeMillis,
						"decision_code": decision.code ?? null,
						"decision_id": decision.id,
						"decision_reason": decision.reason,
						error: null,
						release,
						"request_id": crypto.randomUUID(),
						text,
						"work_id": workId,
					});
				}),
			);
		}),
		finish: (request: AnswerRow, error?: string) =>
			locked(
				request.work_id,
				Effect.gen(function* () {
					const current = (yield* list(request.work_id))[0];
					if (current?.request_id !== request.request_id) {
						return;
					}
					yield* error === undefined ? repository.delete(request.work_id) : repository.updateVoid({ ...request, error });
				}),
			),
		list,
	};
});

export type AnswerRequest = AnswerRow;
