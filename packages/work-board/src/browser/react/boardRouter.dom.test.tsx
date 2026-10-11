import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { expect, it } from "vitest";
import { expectNoReactWarnings, render } from "@shivaedev/effect-react/testing.ts";
import { boardRouter } from "./boardRouter.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();

it("mounts the placeholder route without adding visible content", async () => {
	const router = boardRouter();
	router.update({ history: createMemoryHistory({ initialEntries: ["/"] }) });
	await router.load();
	const view = await render(<RouterProvider router={router} />);
	try {
		expect(router.state.matches.map(({ status }) => status)).toEqual(["success", "success"]);
		expect(view.container.childNodes).toHaveLength(0);
	} finally {
		await view.unmount();
	}
});
