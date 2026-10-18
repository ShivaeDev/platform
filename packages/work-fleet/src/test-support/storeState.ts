import { Effect, Schema } from "effect";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { fleetRecords } from "#fleetRecords.ts";
import type { FleetHost } from "#host/config.ts";
import { makeFleetTransaction } from "#storage/makeFleetTransaction.ts";
import { recordInput, recordModel } from "#storage/model.ts";
import { writeChildren } from "#storage/recordChildren.ts";
import { recordShape } from "#storage/recordShape.ts";

export function storeState(host: FleetHost, workId: string, payload: Readonly<Record<string, unknown>>) {
	return Effect.gen(function* () {
		const transaction = yield* makeFleetTransaction;
		return yield* transaction(
			[fleetRecords.item(workId), fleetRecords.list],
			Effect.gen(function* () {
				const model = recordModel();
				const repository = yield* makeRepository(model, {
					idColumn: "work_id",
					spanPrefix: "Fixture",
					tableName: `${host.namespace}_records`,
					versionColumn: "version",
				});
				const input = yield* Schema.decodeUnknownEffect(model.insert)({
					...recordInput(payload),
					"work_id": workId,
				});
				const previous = yield* repository.findMany({ where: { "work_id": workId } });
				if (previous[0] === undefined) {
					yield* repository.insertVoid(input);
				} else {
					yield* repository.updateVoid({ ...previous[0], ...input });
				}
				yield* writeChildren(host.namespace, workId, payload, recordShape());
			}),
		);
	}).pipe(Effect.orDie);
}
