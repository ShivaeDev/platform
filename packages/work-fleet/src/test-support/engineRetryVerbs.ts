import type { EngineStory } from "#test/engineState.ts";

export function engineRetryVerbs(state: EngineStory, tell: (line: string) => void) {
	return {
		changeHostModel: (model: string) => {
			const launch = state.recovery.launch;
			if (launch === undefined) {
				throw new Error("No mutable host launch settings are configured");
			}
			tell(`the host now selects ${model}`);
			launch.model = model;
		},
		failProviderReads: () => {
			tell("the provider cannot read accepted operations");
			state.recovery.readsFail = true;
		},
		hideProviderTurns: () => {
			tell("the provider hides its acknowledged turn");
			state.recovery.turnHidden = true;
		},
		providerInterruptions: () => [...state.recovery.interrupted],
		recoverProviderReads: () => {
			tell("the provider can read accepted operations again");
			state.recovery.readsFail = false;
		},
		resolvePullRequestConflict: () => {
			tell("the pull request no longer conflicts with main");
			state.conflicting = false;
		},
		setFleetTime: (at: number) => {
			tell(`advance Fleet time to ${at}`);
			state.now = at;
		},
		timeoutObservations: () => {
			const observed = state.recovery.timeout;
			if (observed === undefined) {
				throw new Error("No timed-out provider is configured");
			}
			return { ...observed, inputs: [...observed.inputs], requests: [...observed.requests] };
		},
	};
}
