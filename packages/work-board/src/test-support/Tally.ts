import { Deferred, Effect } from "effect";

// A count the engine bumps on each occurrence, so a story waits for the nth occurrence instead of sampling on a timer.
export class Tally {
	count = 0;
	readonly #waiters: { readonly deferred: Deferred.Deferred<void>; readonly target: number }[] = [];

	bump() {
		this.count += 1;
		for (const waiter of this.#waiters.filter(({ target }) => target <= this.count)) {
			this.#waiters.splice(this.#waiters.indexOf(waiter), 1);
			Deferred.doneUnsafe(waiter.deferred, Effect.void);
		}
	}

	reaches(target: number) {
		return Effect.suspend(() => {
			if (this.count >= target) {
				return Effect.void;
			}
			const deferred = Deferred.makeUnsafe<void>();
			this.#waiters.push({ deferred, target });
			return Deferred.await(deferred);
		});
	}
}
