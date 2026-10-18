import { expect } from "vitest";
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
