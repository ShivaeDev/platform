import { Effect } from "effect";
import { forwardingProxy } from "@shivaedev/test-story/server/forwardingProxy.ts";
import { boardStory } from "#test/boardStory.ts";
import { type BoardEngine, served } from "#test/storyEngine.ts";

export function connectionBoundary(browserClient: (url: string) => NonNullable<BoardEngine["server"]>["client"]) {
	return boardStory.trait("reader", "native RPC crosses a connection that can go offline", function* (engine) {
		const { board } = served(engine);
		const relay = yield* forwardingProxy(board.url);
		const client = browserClient(relay.url);
		yield* Effect.addFinalizer(() => Effect.sync(() => client.registry.dispose()));
		engine.server = { board, client };
		engine.connectionBoundary = { disconnect: relay.disconnect, resume: relay.online };
	});
}
