import { Effect } from "effect";
import { acquireConnectedClient, assertAvailableModelNames } from "#internal/client-lifecycle.ts";
import { fromPrismaPromise } from "#internal/promise.ts";
import { FakeResult } from "#test/controlled-collection.ts";

const initializationFailure = Effect.fnUntraced(function* () {
	let closed = false;
	const exit = yield* Effect.exit(
		Effect.promise(() =>
			acquireConnectedClient(
				{
					close: () => {
						closed = true;
						return Promise.resolve();
					},
					connect: () => Promise.resolve(),
				},
				() => {
					throw new Error("model discovery failed");
				},
			),
		),
	);
	return { closed, exit };
});
export function relationProbes() {
	return {
		adaptThenable: () => fromPrismaPromise(() => new FakeResult([{ active: true, id: 1 }])),
		assertModelNames: assertAvailableModelNames,
		initializationFailure,
		rejectUnknownPromise: () => Effect.exit(fromPrismaPromise(() => Promise.reject(new Error("unknown")))),
	};
}
