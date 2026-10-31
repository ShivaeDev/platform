import { Effect, Queue, Result, Stream } from "effect";
import { isClientIdle } from "@shivaedev/contract/clientActivity.ts";
import { screenMutations } from "#adapters/screenMutations.ts";
import type { ScreenDriverOptions } from "#screenDriver.ts";

type WaitOptions = Required<Pick<ScreenDriverOptions, "act">> & {
	readonly pending: ScreenDriverOptions["pending"];
	readonly root: () => HTMLElement;
};

const observePending = Effect.fnUntraced(function* (pending: ScreenDriverOptions["pending"], changes: Queue.Queue<void>) {
	if (pending === undefined) {
		return Effect.succeed(false);
	}
	if (typeof pending === "function") {
		return Effect.sync(pending);
	}
	let busy = true;
	const states = "current" in pending ? Stream.map(pending, (state) => !isClientIdle(state)) : pending;
	yield* states.pipe(
		Stream.runForEach((value) =>
			Effect.sync(() => {
				busy = value;
				Queue.offerUnsafe(changes, undefined);
			}),
		),
		Effect.forkScoped,
	);
	return "current" in pending ? Effect.map(pending.current, (state) => !isClientIdle(state)) : Effect.sync(() => busy);
});

export const waitForScreen = Effect.fnUntraced(function* <A, E>({ act, pending, root }: WaitOptions, read: Effect.Effect<A, E>) {
	const changes = yield* Queue.sliding<void>(1);
	yield* screenMutations(root(), () => Queue.offerUnsafe(changes, undefined));
	const isBusy = yield* observePending(pending, changes);
	do {
		if (pending !== undefined) {
			yield* Effect.promise(() => act(() => Promise.resolve()));
		}
		if (!(yield* isBusy)) {
			const result = yield* Effect.result(read);
			if (Result.isSuccess(result)) {
				return result.success;
			}
		}
		yield* pending === undefined ? Queue.take(changes) : Effect.promise((signal) => act(() => Effect.runPromise(Queue.take(changes), { signal })));
	} while (true);
}, Effect.scoped);
