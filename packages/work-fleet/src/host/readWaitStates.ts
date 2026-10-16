import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Model } from "effect/schema";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { State } from "#host/waitOutcome.ts";
import { columnSchema, schemaShape, shapeColumns } from "#storage/recordShape.ts";
import { recordValues } from "#storage/recordValue.ts";

export interface ReadOptions {
	readonly namespace: string;
}

export const readWaitStates = Effect.fn("FleetReader.readWaitStates")(function* (options: ReadOptions, ids?: readonly string[]) {
	const shape = schemaShape(State);
	class SnapshotRow extends Model.Class<SnapshotRow>("FleetSnapshot")({
		...Object.fromEntries(Object.entries(shapeColumns(shape)).map(([name, kind]) => [name, columnSchema(kind)])),
		"work_id": Schema.String,
	}) {}
	const read = Effect.gen(function* () {
		const repository = yield* makeRepository(SnapshotRow, {
			idColumn: "work_id",
			spanPrefix: "FleetReader",
			tableName: `${options.namespace}_records`,
		});
		const rows = yield* repository
			.findMany({
				orderBy: { direction: "asc", field: "work_id" },
			})
			.pipe(
				Effect.catchTag("SqlError", (error) => {
					const cause = error.reason.cause;
					return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "42P01" ? Effect.succeed([]) : Effect.fail(error);
				}),
			);
		const selected = rows.filter((row) => ids === undefined || ids.includes(row.work_id));
		const states = yield* Schema.decodeUnknownEffect(Schema.Array(State))(yield* recordValues(selected, shape, options.namespace));
		return states.map((state) => ({ ...state, outcome: state.outcome ?? {} }));
	});
	return yield* read;
});
