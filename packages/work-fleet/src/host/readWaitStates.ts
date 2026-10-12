import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { State } from "#host/waitOutcome.ts";
import { recordColumns, recordJson, recordModel } from "#storage/model.ts";

export interface ReadOptions {
	readonly namespace: string;
}

export const readWaitStates = Effect.fn("FleetReader.readWaitStates")(function* (options: ReadOptions, ids?: readonly string[]) {
	const read = Effect.gen(function* () {
		const repository = yield* makeRepository(recordModel(), {
			idColumn: "work_id",
			spanPrefix: "FleetReader",
			tableName: `${options.namespace}_records`,
		});
		const rows = yield* repository
			.findMany({
				orderBy: { direction: "asc", field: "work_id" },
				select: ["work_id", "stage", "blocker", "attentionOwner", "checks", "decision", "outcome"],
			})
			.pipe(
				Effect.catchTag("SqlError", (error) => {
					const cause = error.reason.cause;
					return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "42P01" ? Effect.succeed([]) : Effect.fail(error);
				}),
			);
		return yield* Effect.forEach(
			rows.filter((row) => ids === undefined || ids.includes(row.work_id)),
			(row) =>
				recordJson(row, recordColumns()).pipe(
					Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(State))),
					Effect.map((state) => ({ ...state, outcome: state.outcome ?? {} })),
				),
		);
	});
	return yield* read;
});
