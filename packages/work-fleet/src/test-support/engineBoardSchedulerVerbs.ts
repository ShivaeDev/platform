import type { SessionReceipt } from "#session/schema.ts";
import type { EngineStory } from "#test/engineState.ts";

export function engineBoardSchedulerVerbs(state: EngineStory, tell: (line: string) => void) {
	function provider() {
		if (state.schedulerProvider === undefined) {
			throw new Error("No scheduler provider is configured");
		}
		return state.schedulerProvider;
	}
	return {
		finishSchedulerTurn: (receipt: SessionReceipt | undefined) => {
			if (receipt === undefined) {
				throw new Error("No worker receipt is recorded");
			}
			tell(`the provider completes ${receipt.turnId}`);
			provider().finish(receipt);
		},
		holdSchedulerObservation: (receipt: SessionReceipt | undefined) => {
			if (receipt === undefined) {
				throw new Error("No worker receipt is recorded");
			}
			tell(`hold the provider observation of ${receipt.turnId}`);
			return provider().hold(receipt.sessionId);
		},
	};
}
