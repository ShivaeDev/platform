import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import type { SessionReceipt } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { type EngineFixture, prepareWork } from "#test/engine.ts";
import { parkStalled, stalledTransport } from "#test/parkStalled.ts";
import { postgresTests } from "#test/postgres.ts";
import { answerReport } from "#test/report.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

for (const action of ["retry", "dispatch", "release"] as const) {
	postgresTests("test")(`an edited brief preserves stalled recovery across restart and ${action}`, () => {
		let now = 0;
		return withFleetBoard({ decorateTransport: stalledTransport, now: () => now }, (fixture, root, source) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				const { attempt, receipt, stalled } = yield* stalledWork(() => {
					now += 31 * 60_000;
				});
				const current = `${source}\nRevised acceptance criteria.\n`;
				boardHttpFiles(root).write("one.md", current);
				const changed = yield* fixture.restart(fleet.reconcile("one"));
				const decision = changed.value.decision;
				if (decision?.published === undefined) {
					return yield* Effect.die("Missing context decision");
				}
				expect(decision.reason).toBe("Board context changed");
				const resolved = yield* fixture.restart(
					action === "dispatch" ? fleet.dispatch("one") : fleet.resolve("one", decision.id, answerReport(root, decision.published, action)),
				);
				expect(resolved.value.attempts.at(action === "dispatch" ? -2 : -1)).toMatchObject({
					abandoned: { at: now },
					sessionUnusable: true,
					status: "failed",
				});
				expect((yield* fixture.acknowledgeTurn(attempt.operationId, receipt).pipe(Effect.result))._tag).toBe("Failure");
				fixture.observations.set(receipt.turnId, { execution: "completed", output: "Late abandoned output", provisioning: "ready", receipt });
				yield* verifyRecovery(action, fixture, { context: current, receipt, resolved, stalled: stalled.value });
				const observed = yield* fixture.restart(fleet.reconcile("one"));
				const abandoned = observed.value.attempts.find((entry) => entry.operationId === attempt.operationId);
				expect(abandoned).toBeDefined();
				expect(abandoned?.output).toBeUndefined();
				expect(abandoned?.abandoned).toEqual(resolved.value.attempts.find((entry) => entry.operationId === attempt.operationId)?.abandoned);
				expect(observed.value.result).toBeUndefined();
			}),
		);
	});
}

const stalledWork = Effect.fnUntraced(function* (advance: () => void) {
	const fleet = yield* Fleet;
	yield* prepareWork("one");
	yield* fleet.dispatch("one");
	yield* parkStalled(advance);
	advance();
	const stalled = yield* fleet.reconcile("one");
	expect(stalled.value.decision?.code).toBe("session-stalled");
	const attempt = stalled.value.attempts.at(-1);
	const receipt = attempt?.receipt;
	if (attempt === undefined || receipt === undefined) {
		return yield* Effect.die("Missing stalled receipt");
	}
	return { attempt, receipt, stalled };
});

const verifyRecovery = Effect.fnUntraced(function* (
	action: "retry" | "dispatch" | "release",
	fixture: EngineFixture<unknown>,
	previous: { readonly context: string; readonly receipt: SessionReceipt; readonly resolved: Versioned<FleetRecord>; readonly stalled: FleetRecord },
) {
	if (action === "release") {
		expect(previous.resolved.value.stage).toBe("released");
		return;
	}
	const fleet = yield* Fleet;
	const fresh = action === "dispatch" ? previous.resolved : yield* fixture.restart(fleet.dispatch("one"));
	expect(fresh.value.boardContext).toBe(previous.context);
	expect(fresh.value.attempts).toHaveLength(previous.stalled.attempts.length + 1);
	expect(fresh.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(previous.receipt.sessionId);
	expect(fresh.value.attempts.at(-1)?.receipt?.turnId).not.toBe(previous.receipt.turnId);
	expect(fixture.starts).toHaveLength(2);
	expect(fixture.steered).toHaveLength(1);
});
