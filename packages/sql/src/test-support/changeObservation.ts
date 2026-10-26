import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";

export const watchChanges = Effect.fnUntraced(function* (keys: readonly string[]) {
	const reactivity = yield* Reactivity.Reactivity;
	const delivered: string[] = [];
	for (const key of keys) {
		const cancel = reactivity.registerUnsafe([key], () => delivered.push(key));
		yield* Effect.addFinalizer(() => Effect.sync(cancel));
	}
	return delivered;
});

export const throwingSubscriber = Effect.fnUntraced(function* (key: string) {
	const reactivity = yield* Reactivity.Reactivity;
	const cancel = reactivity.registerUnsafe([key], () => {
		throw new Error("subscriber threw");
	});
	yield* Effect.addFinalizer(() => Effect.sync(cancel));
});
