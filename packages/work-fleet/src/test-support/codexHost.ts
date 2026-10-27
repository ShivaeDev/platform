import { Effect } from "effect";
import type { FleetRecord } from "#model.ts";
import { codexConfiguration } from "#test/codex.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { stalledCodex } from "#test/stalledCodex.ts";

const providers = new WeakMap<HostStoryEngine, Effect.Success<ReturnType<typeof stalledCodex>>>();

export const configureCodexHost = Effect.fnUntraced(function* (engine: HostStoryEngine) {
	const provider = yield* stalledCodex();
	providers.set(engine, provider);
	engine.provider = codexConfiguration(provider.endpoint);
});

export function codexHostVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	function provider() {
		const value = providers.get(engine);
		if (value === undefined) {
			throw new Error("Configure the fake Codex provider first");
		}
		return value;
	}
	return {
		codexRequests: () => [...provider().requests],
		codexTurnState: (turnId: string) => provider().states.get(turnId),
		completeCodexTurn: (record: FleetRecord, output: string) => {
			const receipt = record.attempts.at(-1)?.receipt;
			if (receipt === undefined) {
				throw new Error("The work has no acknowledged turn");
			}
			tell(`Codex completes ${receipt.turnId}`);
			provider().complete(receipt.turnId, output);
		},
	};
}
