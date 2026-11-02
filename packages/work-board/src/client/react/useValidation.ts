import { RegistryContext, useAtomSet } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useContext, useMemo } from "react";

export function useValidation<A, E>(validate: Atom.AtomResultFn<void, A, E>) {
	const registry = useContext(RegistryContext);
	const completion = useMemo(
		() =>
			Atom.fn<{ readonly completed: (snapshot: A | undefined) => void }>()(({ completed }) =>
				Effect.gen(function* () {
					registry.set(validate, undefined);
					yield* AtomRegistry.getResult(registry, validate, { suspendOnWaiting: true }).pipe(
						Effect.match({ onFailure: () => completed(undefined), onSuccess: completed }),
					);
				}),
			),
		[registry, validate],
	);
	const dispatch = useAtomSet(completion);
	return (completed: (snapshot: A | undefined) => void) => dispatch({ completed });
}
