import { expect } from "vitest";
import { cookieApp, mintedCookieSession } from "#test-support/cookieApp.ts";

const OK_STATUS = 200;

cookieApp.it(
	"accepts and revokes a minted HttpOnly cookie session on the PostgreSQL host",
	[mintedCookieSession()],
	function* ({ signOut, session, visibleCookies }) {
		expect(visibleCookies()).not.toContain("session_token");
		const signedIn = yield* session();
		expect(signedIn.response.status).toBe(OK_STATUS);
		expect(signedIn.response.headers.get("content-type")).toContain("application/json");
		expect(signedIn.response.headers.get("set-cookie")).toBeNull();
		expect(signedIn.result.error).toBeNull();
		expect(signedIn.session).toMatchObject({ user: { email: "alice@app.test" } });
		expect(signedIn.result.data).toMatchObject({ user: { email: "alice@app.test" } });
		expect(yield* signOut()).toBe(OK_STATUS);
		const revoked = yield* session();
		expect(revoked.response.status).toBe(OK_STATUS);
		expect(revoked.result.error).toBeNull();
		expect(revoked.session).toBeNull();
		expect(revoked.result.data).toBeNull();
	},
);
