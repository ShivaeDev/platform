import type { Effect, Schema } from "effect";
import type { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";

type FleetStore<A extends { readonly workId: string }> = Effect.Success<ReturnType<typeof makePostgresFleetStore<Schema.Codec<A>>>>;

export function storageRecordVerbs<A extends { readonly workId: string }>(current: () => FleetStore<A>, tell: (line: string) => void) {
	return {
		insert: (...args: Parameters<FleetStore<A>["insert"]>) => {
			tell(`insert ${args[0].workId}`);
			return current().insert(...args);
		},
		operations: (operationId: string) => current().operationEntries(operationId),
		records: () => {
			tell("read stored records");
			return current().list();
		},
		releaseForeign: (owner: string) => {
			tell(`release foreign owner ${owner}`);
			return current().releaseForeign(owner);
		},
		reload: (workId: string) => {
			tell(`reload stored record ${workId}`);
			return current().load(workId);
		},
		replace: (...args: Parameters<FleetStore<A>["compareAndSet"]>) => {
			tell(`replace ${args[0]} at version ${args[1]}`);
			return current().compareAndSet(...args);
		},
		reservations: () => {
			tell("read foreign reservations");
			return current().foreignReservations();
		},
		reserveForeign: (...args: Parameters<FleetStore<A>["reserveForeign"]>) => {
			tell(`reserve foreign owner ${args[0]}`);
			return current().reserveForeign(...args);
		},
	};
}
