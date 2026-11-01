import { expect } from "vitest";
import { cookieApp, mintedCookieSession } from "#test-support/cookieApp.ts";

cookieApp.it("a page script cannot read alice's session cookie", [mintedCookieSession()], function* ({ pageScriptCookies }) {
	expect(yield* pageScriptCookies()).toBe("no session token");
});

cookieApp.it("alice's browser reads her session without the app reissuing her cookie", [mintedCookieSession()], function* ({ readsSession }) {
	const session = yield* readsSession();

	expect(session).toEqual({ cookieReissued: false, signedInAs: "alice@app.test" });
});

cookieApp.it("signing out ends alice's browser session", [mintedCookieSession()], function* ({ browserSession, signsOut }) {
	expect(yield* browserSession()).toBe("alice@app.test");

	yield* signsOut();

	expect(yield* browserSession()).toBe("no session");
});
