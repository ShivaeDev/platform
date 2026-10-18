import { Effect } from "effect";
import { Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { allAttempts, executing, type FleetRecord } from "#model.ts";

export const launchReceipt = Effect.fn("Fleet.launchReceipt")(function* (record: FleetRecord, role: "worker" | "repair") {
	if (executing(record)) {
		return yield* Effect.fail(new Forbidden({ message: "Reconcile terminal execution before launching another turn" }));
	}
	const original = allAttempts(record).findLast((previous) => previous.role !== "reviewer" && previous.receipt !== undefined)?.receipt;
	const latest = record.attempts.at(-1);
	if (
		role === "repair"
		&& original === undefined
		&& !(latest?.role !== "reviewer" && latest?.status === "failed" && latest.sessionUnusable && latest.sessionId !== undefined)
	) {
		return yield* Effect.fail(new Forbidden({ message: "Repair requires an existing worker receipt" }));
	}
	return original;
});
