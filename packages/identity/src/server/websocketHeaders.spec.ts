import { expect } from "vitest";
import { trustedOrigins } from "#server/origin.ts";
import { ORIGIN } from "#test/rpc/harness.ts";
import { originPolicy, sessions, signedUp, websocketHeaders } from "#test/rpc/sessionStory.ts";

sessions.it(
	"WebSocket RPC authenticates the session from the upgrade request",
	[originPolicy(), signedUp("alice"), websocketHeaders("alice")],
	function* ({ account, websocket }) {
		const alice = account("alice");
		expect(yield* websocket([])).toContain(alice.userId);
	},
);

sessions.it(
	"WebSocket RPC rejects an untrusted upgrade origin despite forged message headers",
	[originPolicy(), signedUp("alice"), websocketHeaders("alice", { origin: "https://attacker.example" })],
	function* ({ websocket }) {
		expect(yield* websocket([["origin", ORIGIN]])).toMatch(/"_tag":"Forbidden".*"Origin not allowed"/u);
	},
);

sessions.it(
	"WebSocket RPC ignores a message cookie when the upgrade is anonymous",
	[originPolicy(), signedUp("alice"), websocketHeaders()],
	function* ({ account, websocket }) {
		expect(yield* websocket([["cookie", account("alice").cookie]])).toContain('"_tag":"Unauthorized"');
	},
);

sessions.it(
	"WebSocket RPC uses the application's configured origin policy",
	[
		originPolicy("browser", trustedOrigins({ allow: ["https://desktop.example"], missing: "reject" })),
		signedUp("alice"),
		websocketHeaders("alice", { origin: "https://desktop.example" }),
	],
	function* ({ account, websocket }) {
		const alice = account("alice");
		expect(yield* websocket([])).toContain(alice.userId);
	},
);

sessions.it(
	"WebSocket RPC rejects an upgrade origin excluded by the application's configured policy",
	[
		originPolicy("browser", trustedOrigins({ allow: ["https://desktop.example"], missing: "reject" })),
		signedUp("alice"),
		websocketHeaders("alice", { origin: ORIGIN }),
	],
	function* ({ websocket }) {
		expect(yield* websocket([])).toContain('"_tag":"Forbidden"');
	},
);
