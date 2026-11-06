import { Effect } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { render } from "@shivaedev/test-story/client/adapters/react.ts";
import { until } from "@shivaedev/test-story/server/until.ts";

export type Query = Atom.Atom<AsyncResult.AsyncResult<{ readonly title: string; readonly revision: bigint }, unknown>>;
export const blankScreen = Effect.acquireRelease(
	Effect.promise(() => render(null)),
	(screen) => Effect.promise(screen.unmount),
);

export function displayed(screen: Effect.Success<typeof blankScreen>, query: Query, title: string) {
	return Effect.promise(() =>
		act(async () => {
			await Effect.runPromise(
				until(
					AtomRegistry.toStream(screen.registry, query),
					(result) => !result.waiting && (AsyncResult.isFailure(result) || (AsyncResult.isSuccess(result) && result.value.title === title)),
					{ name: "settled live screen" },
				),
			);
		}),
	);
}
