import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Effect } from "effect";
import { boardRouter } from "#client/react/boardRouter.ts";
import { renderBoard } from "./react.tsx";
import { trackScreen } from "./screenEngine.ts";
import { screenStory } from "./screenStory.ts";

export function emptyHostRouter(files: Readonly<Record<string, string>>) {
	return screenStory.trait("screen", "a host mounts a router without Board context", function* (engine) {
		const router = boardRouter();
		router.update({ context: {}, history: createMemoryHistory() });
		engine.router = router;
		trackScreen(engine, yield* Effect.promise(() => renderBoard(files, () => <RouterProvider router={router} />)), (line) => engine.tell?.(line));
	});
}
