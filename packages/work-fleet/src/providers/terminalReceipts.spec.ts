import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { duplicateTurns } from "#test/duplicateTurns.ts";

for (const fault of ["running", "unavailable", "repeated"] as const) {
	it.effect(`duplicate turns with ${fault} evidence do not supply terminal receipts`, function* () {
		const native = duplicateTurns(fault === "running" ? undefined : fault);
		if (fault === "running") {
			native.states.set("third", "inProgress");
		}
		const failed = yield* native.adapter().reconcile({ operationId: "operation-1", sessionId: "session-operation-1" }).pipe(Effect.flip);
		expect(failed.terminalReceipts).toBeUndefined();
		expect(failed.reason).toBe({ repeated: "protocol", running: "ambiguous", unavailable: "unavailable" }[fault]);
	});
}
