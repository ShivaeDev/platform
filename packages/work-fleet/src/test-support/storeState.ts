import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted, Schema } from "effect";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { invalidationKeys } from "@shivaedev/effect-contract/keys.ts";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";
import { fleetRecords } from "#fleetRecords.ts";
import type { FleetHost } from "#host/config.ts";
import { recordColumns, recordInput, recordModel } from "#storage/model.ts";

function hostSql(host: FleetHost) {
	return PgClient.layer({ maxConnections: 2, url: Redacted.make(host.databaseUrl) });
}

export function storeState(host: FleetHost, workId: string, payload: Readonly<Record<string, unknown>>) {
	return Effect.gen(function* () {
		const current = yield* Effect.serviceOption(Reactivity.Reactivity);
		const reactivity = current._tag === "Some" ? current.value : yield* Reactivity.make;
		return yield* transact(
			Effect.gen(function* () {
				const model = recordModel();
				const repository = yield* makeRepository(model, {
					idColumn: "work_id",
					spanPrefix: "Fixture",
					tableName: `${host.namespace}_records`,
					versionColumn: "version",
				});
				const input = yield* Schema.decodeUnknownEffect(model.insert)({
					...recordInput(JSON.stringify(payload), recordColumns()),
					"work_id": workId,
				});
				const previous = yield* repository.findMany({ where: { "work_id": workId } });
				if (previous[0] === undefined) {
					yield* repository.insertVoid(input);
				} else {
					yield* repository.updateVoid({ ...previous[0], ...input });
				}
				yield* invalidateOnCommit(invalidationKeys([fleetRecords.item(workId), fleetRecords.list]));
			}),
			{ onSqlError: (error) => error },
		).pipe(Effect.provideService(Reactivity.Reactivity, reactivity), Effect.provide(hostSql(host)));
	}).pipe(Effect.orDie);
}
