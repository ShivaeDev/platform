import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { boardRouter } from "#client/react/boardRouter.ts";
import type { BoardFixtureOptions } from "./inMemoryBoard.ts";
import { renderBoard } from "./react.tsx";

export async function renderRouter(files: Readonly<Record<string, string>>, url: string, options?: BoardFixtureOptions) {
	const reading = window.history.state?.workBoard;
	let router: ReturnType<typeof boardRouter> | undefined;
	const view = await renderBoard(
		files,
		(api, registry) => {
			router = boardRouter({ api, initial: "", reading, registry });
			router.update({ context: router.options.context, history: createMemoryHistory({ initialEntries: [url] }) });
			return <RouterProvider router={router} />;
		},
		options,
	);
	if (!router) {
		await view.unmount();
		throw new Error("Missing rendered router");
	}
	return { ...view, router };
}
