import type { SessionReceipt } from "#session/schema.ts";
import { type EngineStory, running } from "#test/engineState.ts";

export function engineEvidence(state: EngineStory) {
	function fixture() {
		return running(state).fixture;
	}
	return {
		acknowledgements: () => structuredClone(fixture().acknowledgements),
		boardWork: (id: string) => structuredClone(fixture().work(id)),
		foreignReservations: () => fixture().foreignReservations(),
		launches: () => [...fixture().launched],
		mergedHeads: () => [...fixture().merged],
		providerCalls: () => structuredClone(fixture().settings),
		providerOperationCount: () => fixture().operations.size,
		providerOperations: () => [...fixture().operations.keys()],
		providerStarts: () => structuredClone(fixture().starts),
		publishedDecisions: () => [...fixture().decisions],
		reviewedHeads: () => [...fixture().reviews],
		turnOutput: (receipt: SessionReceipt | undefined) => (receipt === undefined ? undefined : fixture().observations.get(receipt.turnId)?.output),
	};
}
