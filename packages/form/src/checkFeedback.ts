import { type Duration, Effect, Equal } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRef from "effect/reactivity/AtomRef";
import { fromRef } from "./refs.ts";
import type { Encoded, Fields, Name, Services } from "./shape.ts";

export function checkFeedback<TFields extends Fields, R, E>(
	runtime: Atom.AtomRuntime<Services<TFields, R>, E>,
	checks: ReadonlyMap<string, (value: Encoded<TFields>[Name<TFields>]) => Effect.Effect<string | undefined, never, R>>,
	refFor: <TKey extends Name<TFields>>(name: TKey) => AtomRef.AtomRef<Encoded<TFields>[TKey]>,
	debounce: Duration.Input,
) {
	return Atom.family((name: Name<TFields>): Atom.Atom<string | undefined> => {
		const check = checks.get(name);
		if (check === undefined) {
			return Atom.make((): string | undefined => undefined);
		}
		const current = fromRef(refFor(name));
		const settled = Atom.debounce(current, debounce);
		const answered = runtime.atom((get) => {
			const input = get(settled);
			return Effect.map(check(input), (message) => ({
				input,
				message,
			}));
		});
		return Atom.readable((get): string | undefined => {
			const result = get(answered);
			const value = get(current);
			return AsyncResult.isSuccess(result) && !result.waiting && Equal.equals(result.value.input, value) ? result.value.message : undefined;
		});
	});
}
