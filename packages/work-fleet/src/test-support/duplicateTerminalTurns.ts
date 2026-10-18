import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";
import { duplicateTurns } from "#test/duplicateTurns.ts";
import { engineScenario } from "#test/engineScenario.ts";

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

export function duplicateTerminalTurns(fault: "acknowledged" | "mismatch" | "none" | "running" | "unavailable" | "wrong-session") {
	return engineScenario("the provider reports three terminal receipts with conflicting evidence", () => {
		const native = duplicateTurns();
		let restored = false;
		const receipts = ["first", "second", "third"].map((turnId) => ({ sessionId: "session-operation-1", turnId }));
		return {
			context: {
				native,
				receipts,
				get restored() {
					return restored;
				},
				set restored(value: typeof restored) {
					restored = value;
				},
			},
			options: {
				decorateTransport: decorated(native, fault, () => restored),
				lostAcknowledgement: true,
			},
		};
	});
}
