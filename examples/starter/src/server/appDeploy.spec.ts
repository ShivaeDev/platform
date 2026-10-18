import { Effect } from "effect";
import { expect } from "vitest";
import { app, behindProxy } from "#test-support/application.ts";

app.it("serves the deployment health check after database migrations", [], function* ({ runningHost }) {
	const response = yield* Effect.promise(() => fetch(`${runningHost().baseUrl}/health`));
	expect(response.status).toBe(200);
	expect(yield* Effect.promise(() => response.text())).toBe("");
});

app.it(
	"authenticates and serves protected RPC behind an HTTPS forwarding proxy using environment settings",
	[behindProxy()],
	function* ({ authenticateResponse, notes, foreignRequest }) {
		for (const path of ["sign-up/email", "sign-in/email"]) {
			const result = yield* authenticateResponse("deployed", path);
			expect(result.status).toBe(200);
			expect(result.cookies.some((value) => value.startsWith("__Secure-better-auth.session_token=") && /; Secure(?:;|$)/iv.test(value))).toBe(true);
			const cookie = result.cookie;
			const client = yield* notes(cookie);
			expect(yield* client.list()).toEqual([]);
			expect(yield* foreignRequest(cookie)).toBe(403);
		}
	},
);
