import { Effect } from "effect";
import { Forbidden } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { allAttempts, executing, type FleetRecord } from "#model.ts";

export const launchReceipt = Effect.fn("Fleet.launchReceipt")(function* (record: FleetRecord, role: "worker" | "repair") {
	if (executing(record)) {
		return yield* Effect.fail(new Forbidden({ message: "Reconcile terminal execution before launching another turn" }));
	}
	const original = allAttempts(record).findLast((previous) => previous.role !== "reviewer" && previous.receipt !== undefined)?.receipt;
	const publishedRecovery = record.attempts.some(
		(attempt) =>
			attempt.role !== "reviewer"
			&& attempt.status === "failed"
			&& attempt.sessionUnusable
			&& attempt.sessionId !== undefined
			&& attempt.publishedRecovery,
	);
	if (role === "repair" && original === undefined && !publishedRecovery) {
		return yield* Effect.fail(new Forbidden({ message: "Repair requires an existing worker receipt" }));
	}
	return original;
});
