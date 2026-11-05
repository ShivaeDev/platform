import { RegistryContext, useAtomSuspense } from "@effect/atom-react";
import { Duration, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { useContext, useEffect, useState } from "react";

const defaultRuntime = Atom.runtime(Layer.empty);
type TimerRuntime = Pick<Atom.AtomRuntime<never, unknown>, "atom">;

function debounce<A>(value: A, millis: number, runtime: TimerRuntime) {
	const input = Atom.make({ changed: false, millis, value });
	const result = runtime
		.atom(
			(get) => {
				const next = get(input);
				return next.changed ? Effect.as(Effect.sleep(next.millis), next.value) : Effect.succeed(next.value);
			},
			{ initialValue: value },
		)
		.pipe(Atom.setIdleTTL(0));
	return { input, result };
}

export function useDebouncedValue<A>(value: A, duration: Duration.Input, runtime: TimerRuntime = defaultRuntime): A {
	const registry = useContext(RegistryContext);
	const millis = Duration.toMillis(Duration.fromInputUnsafe(duration));
	const [held, hold] = useState(() => ({ ...debounce(value, millis, runtime), registry, runtime }));
	let owner = held;
	if (held.registry !== registry || held.runtime !== runtime) {
		owner = { ...debounce(value, millis, runtime), registry, runtime };
		hold(owner);
	}
	useEffect(() => {
		const previous = registry.get(owner.input);
		if (!Object.is(previous.value, value) || previous.millis !== millis) {
			registry.set(owner.input, { changed: true, millis, value });
		}
	}, [registry, owner, value, millis]);
	return useAtomSuspense(owner.result).value;
}
