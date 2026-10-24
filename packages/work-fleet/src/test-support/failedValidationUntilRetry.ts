import { Effect } from "effect";
import { engineConfiguration } from "#test/engineConfiguration.ts";

export function failedValidationUntilRetry(controls: { readonly options: () => { checksFailure: boolean; noChange: boolean } }) {
	return engineConfiguration("failed validation until retry", () => ({
		checksQuery: (result) => Effect.succeed({ evidence: ["Required validation"], head: result.head, passed: !controls.options().checksFailure }),
		noChange: true,
	}));
}
