import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { useContext, useState } from "react";

const answer = Atom.make(Effect.succeed(41));

export function Answer({ registries }: { readonly registries: AtomRegistry.AtomRegistry[] }) {
	const registry = useContext(RegistryContext);
	if (!registries.includes(registry)) {
		registries.push(registry);
	}
	const [draft] = useState(() => `draft-${registries.length}`);
	const value = useAtomValue(answer);
	const shown = AsyncResult.isSuccess(value) ? String(value.value + 1) : "…";
	return <output>{`${draft}:${shown}`}</output>;
}

export function Round({ resource, round, rounds }: { readonly resource: Atom.Atom<number>; readonly round: number; readonly rounds: number[] }) {
	rounds.push(round);
	return <output>{`${round}:${useAtomValue(resource)}`}</output>;
}
