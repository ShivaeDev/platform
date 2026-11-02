import { Effect } from "effect";
import { forwardingProxy } from "@shivaedev/test-story/server/forwardingProxy.ts";
import { browserClient } from "#adapters/browserClient.ts";
import { boardStory } from "#test/boardStory.ts";
import { served } from "#test/storyEngine.ts";

export const connectionBoundary = boardStory.trait(
	"reader",
	"native RPC crosses a socket proxy that can hold traffic or go offline",
	function* (engine) {
		const { board } = served(engine);
		const relay = yield* forwardingProxy(board.url);
		const client = browserClient(relay.url);
		yield* Effect.addFinalizer(() => Effect.sync(() => client.registry.dispose()));
		engine.server = { board, client };
		engine.connectionBoundary = { disconnect: relay.disconnect, hold: relay.hold, resume: relay.online };
	},
);
