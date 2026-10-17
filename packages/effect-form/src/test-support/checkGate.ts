import { Deferred, Effect } from "effect";

export function checkGate() {
	const started = new Map<string, Deferred.Deferred<void>>();
	const released = new Map<string, Deferred.Deferred<string | undefined>>();
	function entry<TValue>(map: Map<string, Deferred.Deferred<TValue>>, value: string): Deferred.Deferred<TValue> {
		const known = map.get(value);
		if (known !== undefined) {
			return known;
		}
		const made = Deferred.makeUnsafe<TValue>();
		map.set(value, made);
		return made;
	}
	return {
		answer: (value: string, message: string | undefined) => Deferred.succeed(entry(released, value), message),
		check: (value: string) => Deferred.succeed(entry(started, value), undefined).pipe(Effect.andThen(Deferred.await(entry(released, value)))),
		started: (value: string) => Deferred.await(entry(started, value)),
	};
}
