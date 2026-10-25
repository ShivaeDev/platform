import type { EngineStory } from "#test/engineState.ts";

export function engineLostTurnVerbs(state: EngineStory, tell: (line: string) => void) {
	function change(line: string, action: () => void) {
		action();
		tell(line);
	}
	function lostTurns() {
		if (state.lostTurns === undefined) {
			throw new Error("No lost-turn provider is configured");
		}
		return state.lostTurns;
	}
	function publication() {
		if (state.publication === undefined) {
			throw new Error("No work publication is configured");
		}
		return state.publication;
	}
	return {
		loseTurn: (sessionId: string | undefined) => change("the provider loses the accepted turn", () => lostTurns().lose(sessionId)),
		publishBranch: () => change("publish the remote branch", () => publication().branch()),
		publishPullRequest: (status: "open" | "closed" | "merged" = "open") => change(`publish a ${status} PR`, () => publication().pullRequest(status)),
		rejectNextSubmission: (call: "session" | "turn") =>
			change(`the provider will reject the next ${call} for capacity`, () => {
				state.rejectNextSubmission = call;
			}),
		restoreTurn: (sessionId: string) => change("the provider restores the accepted turn", () => lostTurns().restore(sessionId)),
		setProviderQuota: (available: number) =>
			change(`provider quota permits ${available} submissions`, () => {
				state.providerQuota = available;
			}),
		threadActive: (sessionId: string) => change("the lost thread has another active turn", () => lostTurns().active(sessionId)),
		threadIdle: (sessionId: string) => change("the lost thread becomes idle", () => lostTurns().idle(sessionId)),
	};
}
