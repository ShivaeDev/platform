import { protocolRejectionOptions } from "#test/engineProtocolRejections.ts";
import type { EngineStory } from "#test/engineState.ts";
export function protocolRejections(failure: number | string) {
	return (state: EngineStory) => protocolRejectionOptions(state, failure);
}
