import { engineConfiguration } from "#test/engineConfiguration.ts";
import { protocolRejectionOptions } from "#test/engineProtocolRejections.ts";

export function protocolRejections(failure: number | string) {
	return engineConfiguration("Codex rejects worker submissions over its protocol", (state) => protocolRejectionOptions(state, failure));
}
