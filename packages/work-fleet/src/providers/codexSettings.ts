import { Effect } from "effect";
import type { ThreadResponse } from "#providers/codexProtocol.ts";
import { failure } from "#providers/codexRpc.ts";
import type { LaunchSettings } from "#session/schema.ts";

export function settingsParams(settings: LaunchSettings | undefined) {
	return {
		...(settings?.model === undefined ? {} : { model: settings.model }),
		...(settings?.effort === undefined ? {} : { effort: settings.effort }),
		...(settings?.serviceTier === undefined ? {} : { serviceTier: settings.serviceTier }),
	};
}
// A provider that normalizes or ignores a requested setting must not run work with its own default.
export const echoedSettings = Effect.fn("Codex.echoedSettings")(function* (
	requested: LaunchSettings | undefined,
	response: typeof ThreadResponse.Type,
) {
	const pairs = [
		["model", requested?.model, response.model],
		["reasoning effort", requested?.effort, response.reasoningEffort],
		["service tier", requested?.serviceTier, response.serviceTier],
	] as const;
	for (const [name, wanted, actual] of pairs) {
		if (wanted !== undefined && actual !== undefined && actual !== wanted) {
			return yield* Effect.fail(failure("rejected", `Codex started the thread with ${name} ${actual ?? "unset"} instead of ${wanted}`));
		}
	}
	yield* Effect.logInfo("Codex thread started").pipe(
		Effect.annotateLogs({ model: response.model, reasoningEffort: response.reasoningEffort, serviceTier: response.serviceTier }),
	);
});
