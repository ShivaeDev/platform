import { Effect } from "effect";
import type { ProviderAccountValue } from "@shivaedev/identity/identity.ts";

export function admissionPolicy() {
	const state = { denied: new Set<string>(), unavailable: false };
	return {
		policy: {
			rule: ({ accountId }: ProviderAccountValue) =>
				Effect.try(() => {
					if (state.unavailable) {
						throw new Error("Admission service unavailable");
					}
					return !state.denied.has(accountId);
				}),
		},
		state,
	};
}
