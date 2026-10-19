import type { FleetRecord } from "#model.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

export function hostProviderVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		finishTurn: (record: FleetRecord, output?: string) => {
			const receipt = record.attempts.at(-1)?.receipt;
			const observation = receipt === undefined ? undefined : engine.fixture.provider.observations.get(receipt.turnId);
			if (observation === undefined) {
				throw new Error(`No provider turn exists for ${record.workId}`);
			}
			tell(`the provider finishes ${record.workId}'s turn`);
			engine.fixture.provider.observations.set(observation.receipt.turnId, {
				...observation,
				execution: "completed",
				output: output ?? observation.output,
			});
		},
		mergePullRequest: () => {
			if (engine.pullRequest === undefined) {
				throw new Error("Configure a pull request before merging it");
			}
			tell("a human merges the pull request");
			engine.pullRequest.state.status = "MERGED";
		},
		providerCalls: () => [...engine.fixture.provider.settings],
		providerStarts: () => [...engine.fixture.provider.starts],
		providerSteers: () => [...engine.fixture.provider.steered],
	};
}
