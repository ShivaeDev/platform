import { Effect } from "effect";
import { expect } from "vitest";
import { app, behindProxy } from "#test-support/application.ts";

app.it("serves the deployment health check after database migrations", [], function* ({ baseUrl }) {
	const response = yield* Effect.promise(() => fetch(`${baseUrl}/health`));
	expect(response.status).toBe(200);
	expect(yield* Effect.promise(() => response.text())).toBe("Ready");
});

app.it(
	"authenticates and serves protected RPC behind an HTTPS forwarding proxy using environment settings",
	[behindProxy()],
	function* ({ authenticate, notes, foreignRequest }) {
		for (const path of ["sign-up/email", "sign-in/email"]) {
			const cookie = yield* authenticate("deployed", path);
			const client = yield* notes(cookie);
			expect(yield* client.list()).toEqual([]);
			yield* foreignRequest(cookie);
		}
	},
);
