import type { Effect } from "effect";
import { engineConfiguration } from "#test/engineConfiguration.ts";
export function dependentValidation(controls: {
	readonly options: () => {
		checksQuery: (result: { readonly head: string }) => Effect.Effect<{ evidence: string[]; head: string; passed: boolean }, never, never>;
		noChange: boolean;
	};
}) {
	return engineConfiguration("dependent validation", () => controls.options());
}
