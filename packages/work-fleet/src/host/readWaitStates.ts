import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";
import { Model } from "effect/schema";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { waitingOwner } from "#attention.ts";
import { recoveryStatus } from "#engine/recoveryStatus.ts";
import { State } from "#host/waitOutcome.ts";
import { Attempt } from "#model.ts";
import { StageInput, waitingReason } from "#stage.ts";
import { columnSchema, schemaShape, shapeColumns } from "#storage/recordShape.ts";
import { recordValues } from "#storage/recordValue.ts";

export interface ReadOptions {
	readonly namespace: string;
}

// Only executing work reports a relaunched turn, so other records skip their attempt rows and their worker output.
export const readWaitStates = Effect.fn("FleetReader.readWaitStates")(function* (options: ReadOptions, ids?: readonly string[]) {
	const Summary = Schema.Struct({ ...Struct.omit(State.fields, ["recovery"]), launchRetry: StageInput.fields.launchRetry, step: Schema.String });
	const Snapshot = Schema.Struct({
		...Summary.fields,
		attempts: Schema.optional(Schema.Array(Schema.Struct({ output: Attempt.fields.output, publishedRecovery: Attempt.fields.publishedRecovery }))),
		launchRetry: StageInput.fields.launchRetry,
		step: Schema.String,
	});
	const shape = schemaShape(Snapshot);
	class SnapshotRow extends Model.Class<SnapshotRow>("FleetSnapshot")({
		...Object.fromEntries(Object.entries(shapeColumns(shape)).map(([name, kind]) => [name, columnSchema(kind)])),
		stage: Schema.NullOr(Schema.String),
		"work_id": Schema.String,
	}) {}
	const repository = yield* makeRepository(SnapshotRow, {
		idColumn: "work_id",
		spanPrefix: "FleetReader",
		tableName: `${options.namespace}_records`,
	});
	const rows = yield* repository.findMany({ orderBy: { direction: "asc", field: "work_id" } });
	const selected = rows.filter((row) => ids === undefined || ids.includes(row.work_id));
	const executing = selected.filter((row) => row.stage === "working");
	const values = new Map(
		[
			...(yield* recordValues(executing, shape, options.namespace)),
			...(yield* recordValues(
				selected.filter((row) => row.stage !== "working"),
				schemaShape(Summary),
				options.namespace,
			)),
		].map((value) => [value.workId, value]),
	);
	const states = yield* Schema.decodeUnknownEffect(Schema.Array(Snapshot))(selected.map((row) => values.get(row.work_id)));
	return states.map(({ attempts, step, launchRetry, ...state }) => {
		const record = { ...state, launchRetry, step };
		const recovery = recoveryStatus(attempts, step);
		const attentionOwner = waitingOwner(record);
		const blocker = state.stage === "waiting" ? waitingReason(record) : state.blocker;
		return {
			...state,
			...(attentionOwner === undefined ? {} : { attentionOwner }),
			...(blocker === undefined ? {} : { blocker }),
			...(recovery === undefined ? {} : { recovery }),
			outcome: state.outcome ?? {},
		};
	});
});
