import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { SessionFailure, type SessionReceipt } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";
import { duplicateTurns } from "#test/duplicateTurns.ts";
import { type EngineFixture, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);
const REASON = "Multiple Codex turns match one operation; retain reservation";

function decorated(native: ReturnType<typeof duplicateTurns>, fault: string, restored: () => boolean) {
	return (transport: typeof SessionTransport.Service): typeof SessionTransport.Service => ({
		...transport,
		observe: (receipt) => {
			if (!restored() && receipt.turnId === "third") {
				if (fault === "unavailable") {
					return Effect.fail(new SessionFailure({ message: "Thread evidence is unavailable", reason: "unavailable" }));
				}
				if (fault === "running") {
					native.states.set("third", "inProgress");
				}
			}
			return native
				.adapter()
				.observe(receipt)
				.pipe(
					Effect.map((observation) =>
						!restored() && fault === "mismatch" && receipt.turnId === "third"
							? { ...observation, receipt: { ...receipt, turnId: "wrong" } }
							: observation,
					),
				);
		},
		reconcile: (input) => native.adapter().reconcile(input),
	});
}

const recover = Effect.fnUntraced(function* (
	fixture: EngineFixture,
	native: ReturnType<typeof duplicateTurns>,
	fault: string,
	receipts: readonly SessionReceipt[],
	restore: () => void,
) {
	yield* prepareWork("one");
	const fleet = yield* Fleet;
	yield* fleet.dispatch("one");
	const stopped = yield* fleet.reconcile("one");
	expect(stopped.value.decision?.reason).toBe(REASON);
	expect(stopped.value.attempts[0]?.terminalReceipts).toEqual(receipts);
	if (fault === "wrong-session") {
		yield* fixture.replaceRecord({
			...stopped.value,
			attempts: stopped.value.attempts.map((attempt) => ({
				...attempt,
				terminalReceipts: [...receipts.slice(0, 2), { sessionId: "other-session", turnId: "third" }],
			})),
		});
	}
	const decisionId = stopped.value.decision?.id ?? "missing";
	if (fault === "acknowledged") {
		yield* fixture.acknowledgeTurn("operation-1", { sessionId: "session-operation-1", turnId: "third" });
	}
	const retryId = fixture.respond(decisionId, "retry");
	expect((yield* fleet.resolve("one", decisionId, retryId).pipe(Effect.result))._tag).toBe("Failure");
	const responseId = fixture.respond(decisionId, "release");
	const resolve = Fleet.pipe(Effect.flatMap((resumed) => resumed.resolve("one", decisionId, responseId)));
	if (fault !== "none" && fault !== "acknowledged") {
		expect((yield* fixture.restart(resolve.pipe(Effect.result)))._tag).toBe("Failure");
		expect((yield* fleet.get("one")).value.stage).toBe("needs-human");
		const pending = yield* fleet.get("one");
		yield* fixture.replaceRecord({
			...pending.value,
			attempts: pending.value.attempts.map((attempt) => ({ ...attempt, terminalReceipts: receipts })),
		});
	}
	restore();
	native.states.set("third", "completed");
	const released = yield* fixture.restart(resolve);
	expect(released.value.stage).toBe("released");
	expect(released.value.attempts[0]?.terminalReceipts).toEqual(receipts);
	expect(released.value.attempts[0]?.receipt?.turnId).toBe(fault === "acknowledged" ? "third" : undefined);
	expect(fixture.settings.filter((setting) => setting.call === "turn")).toHaveLength(1);
	expect((yield* fixture.restart(resolve)).value.responses).toEqual(released.value.responses);
});

for (const fault of ["none", "running", "unavailable", "mismatch", "wrong-session", "acknowledged"] as const) {
	test(`duplicate completed turns persist every paginated receipt and release with ${fault} evidence after restart`, () => {
		const native = duplicateTurns();
		let restored = false;
		const receipts = ["first", "second", "third"].map((turnId) => ({ sessionId: "session-operation-1", turnId }));
		return withEngine(
			{
				decorateTransport: decorated(native, fault, () => restored),
				lostAcknowledgement: true,
			},
			(fixture) =>
				recover(fixture, native, fault, receipts, () => {
					restored = true;
				}),
		);
	});
}
