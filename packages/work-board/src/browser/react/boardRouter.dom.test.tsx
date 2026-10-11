import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { it } from "@shivaedev/effect-test/it.ts";
import { boardRouter } from "./boardRouter.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
it.live("mounts the placeholder route without adding visible content", function* () {
	const router = boardRouter();
	router.update({ history: createMemoryHistory({ initialEntries: ["/"] }) });
	yield* Effect.promise(() => router.load());
	const view = yield* Effect.promise(() => render(<RouterProvider router={router} />));
	try {
		expect(router.state.matches.map(({ status }) => status)).toEqual(["success", "success"]);
		expect(view.container.childNodes).toHaveLength(0);
	} finally {
		yield* Effect.promise(() => view.unmount());
	}
});
