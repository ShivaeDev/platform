import { useAtomSuspense } from "@effect/atom-react";
import { Clock, Effect, Layer } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

const defaultRuntime = Atom.runtime(Layer.empty);

type ClockRuntime = Pick<Atom.AtomRuntime<never, unknown>, "atom">;

function ticking<R, E>(runtime: Pick<Atom.AtomRuntime<R, E>, "atom">, interval: number) {
	return runtime.atom((get) =>
		Effect.gen(function* () {
			const update = Effect.gen(function* () {
				const time = yield* Clock.currentTimeMillis;
				get.setSelf(AsyncResult.success(time));
			});
			yield* Effect.forkScoped(Effect.forever(Effect.sleep(interval).pipe(Effect.andThen(update))));
			return yield* Clock.currentTimeMillis;
		}),
	);
}
const nowAtom = Atom.family((runtime: ClockRuntime) => Atom.family((interval: number) => ticking(runtime, interval)));

export function useNow(interval: number, runtime: ClockRuntime = defaultRuntime): number {
	return useAtomSuspense(nowAtom(runtime)(interval)).value;
}
