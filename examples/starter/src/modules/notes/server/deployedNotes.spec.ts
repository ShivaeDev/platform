import { expect } from "vitest";
import { app, behindProxy } from "#modules/notes/test-support/application.ts";

const OK_STATUS = 200;
const FORBIDDEN_STATUS = 403;

app.it(
	"authenticates and serves protected RPC behind an HTTPS forwarding proxy using environment settings",
	[behindProxy()],
	function* ({ authenticateResponse, notes, foreignRequest }) {
		const result = yield* authenticateResponse("deployed", "sign-up/email");
		expect(result.status).toBe(OK_STATUS);
		expect(result.cookies.some((value) => value.startsWith("__Secure-better-auth.session_token=") && /; Secure(?:;|$)/iv.test(value))).toBe(true);
		const cookie = result.cookie;
		const client = yield* notes(cookie);
		expect(yield* client.list()).toEqual([]);
		expect(yield* foreignRequest(cookie)).toBe(FORBIDDEN_STATUS);
	},
);
