import { Effect } from "effect";
import type { EngineOptions } from "#test/EngineOptions.ts";

export function failedValidationUntilRetry(controls: { readonly options: () => { checksFailure: boolean; noChange: boolean } }) {
	return (): EngineOptions => ({
		checksQuery: (result) => Effect.succeed({ evidence: ["Required validation"], head: result.head, passed: !controls.options().checksFailure }),
		noChange: true,
	});
}
