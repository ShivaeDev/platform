import { expect } from "vitest";
import { browserOrigins, sessions, signedUp, webSocketOpened } from "#test/rpc/sessionStory.ts";

sessions.it(
	"over WebSocket, alice's session comes from her upgrade request",
	[browserOrigins, signedUp("alice"), webSocketOpened("alice", "the app")],
	function* ({ websocketWhoami }) {
		expect(yield* websocketWhoami()).toBe("alice");
	},
);

sessions.it(
	"a WebSocket upgraded from another site is refused even when a message claims the app's origin",
	[browserOrigins, signedUp("alice"), webSocketOpened("alice", "another site")],
	function* ({ websocketWhoami }) {
		expect(yield* websocketWhoami({ message: { origin: "the app" } })).toBe("forbidden origin");
	},
);

sessions.it(
	"a message carrying alice's cookie does not sign in an anonymous WebSocket",
	[browserOrigins, signedUp("alice"), webSocketOpened("anonymous", "the app")],
	function* ({ websocketWhoami }) {
		expect(yield* websocketWhoami({ message: { cookieOf: "alice" } })).toBe("unauthorized");
	},
);
