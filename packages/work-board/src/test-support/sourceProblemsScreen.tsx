import { Effect } from "effect";
import { render } from "@shivaedev/test-story/client/react.ts";
import { SystemSourceProblems } from "#client/react/SystemSourceProblems.tsx";
import { rpcCall } from "./nativeRpc.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export const sourceProblemsScreen = Effect.fn("Story.sourceProblemsScreen")(function* (engine: BoardEngine) {
	Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
	const inbox = yield* rpcCall(served(engine).board, (client) => client("work-board.inbox", undefined));
	return yield* Effect.acquireRelease(
		Effect.promise(() => render(<SystemSourceProblems failed={false} issues={inbox.issues} />)),
		(view) => Effect.promise(() => view.unmount()),
	);
});
