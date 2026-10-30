import { Effect } from "effect";
import { vi } from "vitest";
import * as Index from "#server/search/watchIndex.ts";

export const indexDeliveryBoundary = Effect.gen(function* () {
	let events: Effect.Success<ReturnType<typeof Index.watchIndex>>["changes"]["events"] | undefined;
	const start = Index.watchIndex;
	const spy = vi.spyOn(Index, "watchIndex").mockImplementation((...args) =>
		start(...args).pipe(
			Effect.tap((index) =>
				Effect.sync(() => {
					events = index.changes.events;
				}),
			),
		),
	);
	yield* Effect.addFinalizer(() => Effect.sync(() => spy.mockRestore()));
	return (candidate: unknown) => candidate === events;
});
