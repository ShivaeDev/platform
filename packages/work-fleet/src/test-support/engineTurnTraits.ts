import { Effect } from "effect";
import { SessionFailure } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";
import { duplicateTurns } from "#test/duplicateTurns.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { missingTurnTransport } from "#test/missingTurnTransport.ts";

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
	return engineConfiguration("the provider reports three terminal receipts with conflicting evidence", (state) => {
		const native = duplicateTurns();
		state.terminalEvidenceRestored = false;
		const receipts = ["first", "second", "third"].map((turnId) => ({ sessionId: "session-operation-1", turnId }));
		state.nativeTurns = native;
		state.terminalReceipts = receipts;
		return {
			decorateTransport: decorated(native, fault, () => state.terminalEvidenceRestored),
			lostAcknowledgement: true,
		};
	});
}
export function workerTurnDisappears(lostAcknowledgement: boolean) {
	return engineConfiguration("a worker turn disappears with an optional lost acknowledgement", (state) => {
		const missing = missingTurnTransport();
		state.missingTurns = missing;
		return { decorateTransport: missing.decorate, lostAcknowledgement };
	});
}
