import { expect } from "vitest";
import { trustedOrigins } from "#rpc-server/origin.ts";
import { ORIGIN } from "#test/rpc/harness.ts";
import { originPolicy, sessions, signedUp, websocketHeaders } from "#test/rpc/sessionStory.ts";

sessions.it(
	"WebSocket RPC decides origin and session from the upgrade request, not message headers",
	[originPolicy(), signedUp("alice"), websocketHeaders("alice")],
	function* ({ account, websocket }) {
		const alice = account("alice");
		expect(yield* websocket([])).toContain(alice.userId);
		const hijack = yield* websocket([["origin", ORIGIN]], { cookie: alice.cookie, origin: "https://attacker.example" });
		expect(hijack).toMatch(/"_tag":"Forbidden".*"Origin not allowed"/u);
		expect(yield* websocket([["cookie", alice.cookie]], { origin: ORIGIN })).toContain('"_tag":"Unauthorized"');
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
		expect(yield* websocket([], { cookie: alice.cookie, origin: ORIGIN })).toContain('"_tag":"Forbidden"');
	},
);
