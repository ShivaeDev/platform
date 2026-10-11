import { Effect } from "effect";
import { allAttempts, executing, type FleetRecord } from "#model.ts";
import { FleetFailure } from "#policy.ts";

export const launchReceipt = Effect.fn("Fleet.launchReceipt")(function* (record: FleetRecord, role: "worker" | "repair") {
	if (executing(record)) {
		return yield* Effect.fail(new FleetFailure({ message: "Reconcile terminal execution before launching another turn", reason: "denied" }));
	}
	const original = allAttempts(record).findLast((previous) => previous.role !== "reviewer" && previous.receipt !== undefined)?.receipt;
	if (role === "repair" && original === undefined) {
		return yield* Effect.fail(new FleetFailure({ message: "Repair requires an existing worker receipt", reason: "denied" }));
	}
	return original;
});
