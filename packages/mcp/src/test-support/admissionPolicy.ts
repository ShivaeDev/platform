import { Deferred, Effect } from "effect";
import type { ProviderAccountValue } from "@shivaedev/identity/identity.ts";

export const admissionPolicy = Effect.gen(function* () {
	const state = {
		denied: new Set<string>(),
		entered: yield* Deferred.make<void>(),
		paused: new Set<string>(),
		resume: yield* Deferred.make<void>(),
		unavailable: false,
	};
	return {
		policy: {
			rule: ({ accountId }: ProviderAccountValue) =>
				Effect.gen(function* () {
					const admitted = yield* Effect.try(() => {
						if (state.unavailable) {
							throw new Error("Admission service unavailable");
						}
						return !state.denied.has(accountId);
					});
					if (state.paused.delete(accountId)) {
						yield* Deferred.succeed(state.entered, undefined);
						yield* Deferred.await(state.resume);
					}
					return admitted;
				}),
		},
		state,
	};
});
