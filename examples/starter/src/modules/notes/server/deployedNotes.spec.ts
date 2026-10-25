import { expect } from "vitest";
import { app, behindProxy } from "#modules/notes/test-support/application.ts";

app.it(
	"authenticates and serves protected RPC behind an HTTPS forwarding proxy using environment settings",
	[behindProxy()],
	function* ({ authenticateResponse, notes, foreignRequest }) {
		const result = yield* authenticateResponse("deployed", "sign-up/email");
		expect(result.status).toBe(200);
		expect(result.cookies.some((value) => value.startsWith("__Secure-better-auth.session_token=") && /; Secure(?:;|$)/iv.test(value))).toBe(true);
		const cookie = result.cookie;
		const client = yield* notes(cookie);
		expect(yield* client.list()).toEqual([]);
		expect((yield* foreignRequest(cookie)).status).toBe(403);
	},
);
