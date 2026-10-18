import { Effect } from "effect";
import { makeRepository } from "@shivaedev/effect-sql/repository.ts";
import { fleetRecords } from "#fleetRecords.ts";
import { admissionLock } from "#storage/admissionLock.ts";
import { makeFleetTransaction } from "#storage/makeFleetTransaction.ts";
import { ForeignReservationRow } from "#storage/model.ts";

export const makeForeignReservations = Effect.fn("FleetStore.makeForeignReservations")(function* (namespace: string) {
	const commit = yield* makeFleetTransaction;
	const reservations = yield* makeRepository(ForeignReservationRow, {
		idColumn: "owner",
		spanPrefix: "FleetForeign",
		tableName: `${namespace}_foreign_reservations`,
	});
	const lock = admissionLock(namespace);
	return {
		foreignReservations: () => reservations.findMany({ orderBy: { direction: "asc", field: "owner" } }),
		releaseForeign: (owner: string) =>
			commit(
				[fleetRecords.list],
				Effect.gen(function* () {
					yield* lock;
					yield* reservations.delete(owner);
				}),
			),
		reserveForeign: (owner: string, occupancy: { readonly executing: boolean; readonly backlog: boolean } = { backlog: true, executing: true }) =>
			commit(
				[fleetRecords.list],
				Effect.gen(function* () {
					yield* lock;
					const existing = yield* reservations.findMany({ where: { owner } });
					if (existing.length === 0) {
						yield* reservations.insertVoid({ owner, ...occupancy });
					} else {
						yield* reservations.updateVoid({ owner, ...occupancy });
					}
				}),
			),
	};
});
