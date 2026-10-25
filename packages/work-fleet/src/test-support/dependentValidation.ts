import type { Effect } from "effect";

export function dependentValidation(controls: {
	readonly options: () => {
		checksQuery: (result: { readonly head: string }) => Effect.Effect<{ evidence: string[]; head: string; passed: boolean }, never, never>;
		noChange: boolean;
	};
}) {
	return () => controls.options();
}
