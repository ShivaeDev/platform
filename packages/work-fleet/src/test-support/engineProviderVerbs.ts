import type { FleetRecord } from "#model.ts";
import type { SessionObservation, SessionReceipt } from "#session/schema.ts";
import type { Versioned } from "#storage/model.ts";
import type { EngineFixture } from "#test/engine.ts";
import { reviewerReply } from "#test/reviewerReply.ts";

export function engineProviderVerbs(fixture: EngineFixture<unknown>, tell: (line: string) => void) {
	return {
		loseNextAcknowledgement: () => {
			fixture.loseAcknowledgement();
			tell("the next accepted turn loses its acknowledgement");
		},
		setTurnExecution: (receipt: SessionReceipt, execution: SessionObservation["execution"], output = "") => {
			if (!fixture.observations.has(receipt.turnId)) {
				throw new Error("No matching provider turn is available");
			}
			fixture.observations.set(receipt.turnId, { execution, output, provisioning: "ready", receipt });
			tell(`the provider reports ${execution} for ${receipt.turnId}`);
		},
		turnReports: (record: Versioned<FleetRecord>, output: string) => {
			tell("the provider completes the recorded turn with its report");
			return reviewerReply(fixture, record, output);
		},
		workerReports: (output: string) => {
			if (fixture.observations.size === 0) {
				throw new Error("No worker turn is available to report");
			}
			tell("the worker finishes with its report");
			for (const [turn, observation] of fixture.observations) {
				fixture.observations.set(turn, { ...observation, execution: "completed", output });
			}
		},
	};
}
