import { Clock, Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import type { DispatchRequest } from "#DispatchRequest.ts";
import { fleetRecords } from "#fleetRecords.ts";
import type { DispatchNow } from "#model.ts";
import { makeFleetTransaction } from "#storage/makeFleetTransaction.ts";

class DispatchRow extends Model.Class<DispatchRow>("FleetDispatch")({
	"accepted_at": Schema.Number,
	"completed_at": Schema.NullOr(Schema.Number),
	error: Schema.NullOr(Schema.String),
	"ignore_areas": Schema.NullOr(Schema.Boolean),
	now: Schema.NullOr(Schema.Boolean),
	"request_id": Schema.String,
	status: Schema.Literals(["pending", "completed", "failed"]),
	"work_id": Schema.String,
}) {}

function receipt(row: DispatchRow): DispatchRequest {
	return {
		acceptedAt: row.accepted_at,
		...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
		...(row.error === null ? {} : { error: row.error }),
		id: row.request_id,
		...(row.ignore_areas === true ? { ignoreAreas: true } : {}),
		...(row.now === true ? { now: true } : {}),
		status: row.status,
		workId: row.work_id,
	};
}

export const dispatchStore = Effect.fn("FleetDispatch.dispatchStore")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	const commit = yield* makeFleetTransaction;
	const repository = yield* makeRepository(DispatchRow, {
		conflictColumns: ["work_id"],
		idColumn: "work_id",
		spanPrefix: "FleetDispatch",
		tableName: `${namespace}_dispatches`,
	});
	function list(workId?: string) {
		return repository
			.findMany({ orderBy: { direction: "asc", field: "work_id" }, where: { "work_id": workId } })
			.pipe(Effect.map((rows) => rows.map(receipt)));
	}
	function get(workId: string) {
		return list(workId).pipe(Effect.map((requests) => requests[0] ?? null));
	}
	function locked<A, E, R>(workId: string, body: Effect.Effect<A, E, R>) {
		return commit(
			[fleetRecords.list, fleetRecords.item(workId)],
			sql`select pg_advisory_xact_lock(hashtextextended(${`${namespace}:dispatch:${workId}`}, 0))`.pipe(Effect.andThen(body)),
		);
	}
	const accept = Effect.fn("FleetDispatch.accept")(function* (workId: string, now?: DispatchNow) {
		return yield* locked(
			workId,
			Effect.gen(function* () {
				const current = yield* get(workId);
				if (current?.status === "pending") {
					return current;
				}
				const row = yield* repository.upsert(
					{
						"accepted_at": yield* Clock.currentTimeMillis,
						"completed_at": null,
						error: null,
						"ignore_areas": now?.ignoreAreas ?? null,
						now: now === undefined ? null : true,
						"request_id": crypto.randomUUID(),
						status: "pending",
						"work_id": workId,
					},
					{ updateColumns: ["accepted_at", "completed_at", "error", "ignore_areas", "now", "request_id", "status"] },
				);
				return receipt(row);
			}),
		);
	});
	const finish = Effect.fn("FleetDispatch.finish")(function* (request: DispatchRequest, error?: string) {
		yield* locked(
			request.workId,
			Effect.gen(function* () {
				const current = yield* get(request.workId);
				if (current?.id !== request.id || current.status !== "pending") {
					return;
				}
				yield* repository.updateVoid({
					"accepted_at": current.acceptedAt,
					"completed_at": yield* Clock.currentTimeMillis,
					error: error ?? null,
					"ignore_areas": current.ignoreAreas ?? null,
					now: current.now ?? null,
					"request_id": request.id,
					status: error === undefined ? "completed" : "failed",
					"work_id": request.workId,
				});
			}),
		);
	});
	return { accept, finish, get, list };
});
