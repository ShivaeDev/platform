import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { fleetRecords } from "#fleetRecords.ts";
import { admissionLockKey } from "#storage/admissionLockKey.ts";
import { makeFleetTransaction } from "#storage/makeFleetTransaction.ts";
import { ForeignReservationRow } from "#storage/model.ts";

export const makeForeignReservations = Effect.fn("FleetStore.makeForeignReservations")(function* (namespace: string) {
	const sql = yield* SqlClient.SqlClient;
	const commit = yield* makeFleetTransaction;
	const reservations = yield* makeRepository(ForeignReservationRow, {
		idColumn: "owner",
		spanPrefix: "FleetForeign",
		tableName: `${namespace}_foreign_reservations`,
	});
	const lock = sql`select pg_advisory_xact_lock(hashtextextended(${admissionLockKey(namespace)}, 0))`;
	function exists(owner: string) {
		return reservations.findMany({ where: { owner } }).pipe(Effect.map((rows) => rows.length > 0));
	}
	return {
		foreignReservations: () => reservations.findMany({ orderBy: { direction: "asc", field: "owner" } }),
		releaseForeign: Effect.fn("FleetStore.releaseForeign")(function* (owner: string) {
			if (!(yield* exists(owner))) {
				return;
			}
			yield* commit(
				(deleted) => (deleted ? [fleetRecords.list] : []),
				Effect.gen(function* () {
					yield* lock;
					if (!(yield* exists(owner))) {
						return false;
					}
					yield* reservations.delete(owner);
					return true;
				}),
			);
		}),
		reserveForeign: (
			owner: string,
			occupancy: { readonly executing: boolean; readonly backlog: boolean } = { backlog: true, executing: true },
			areas: readonly string[] = [],
		) =>
			commit(
				[fleetRecords.list],
				Effect.gen(function* () {
					yield* lock;
					const existing = yield* reservations.findMany({ where: { owner } });
					if (existing.length === 0) {
						yield* reservations.insertVoid({ areas, owner, ...occupancy });
					} else {
						yield* reservations.updateVoid({ areas, owner, ...occupancy });
					}
				}),
			),
	};
});
