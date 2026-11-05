import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { Duration, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { useCallback, useContext, useEffect, useMemo } from "react";

const defaultRuntime = Atom.runtime(Layer.empty);
type TimerRuntime = Pick<Atom.AtomRuntime<never, unknown>, "fn">;

export function useDelay(duration: Duration.Input, runtime: TimerRuntime = defaultRuntime) {
	const registry = useContext(RegistryContext);
	const millis = Duration.toMillis(Duration.fromInputUnsafe(duration));
	const timer = useMemo(
		() => runtime.fn((complete: () => void) => Effect.andThen(Effect.sleep(millis), Effect.sync(complete))).pipe(Atom.setIdleTTL(0)),
		[runtime, millis],
	);
	const start = useCallback((complete: () => void) => registry.set(timer, complete), [registry, timer]);
	const result = useAtomValue(timer);
	const cancel = useCallback(() => registry.set(timer, Atom.Interrupt), [registry, timer]);
	useEffect(() => cancel, [cancel]);
	return { cancel, pending: result.waiting, start };
}
