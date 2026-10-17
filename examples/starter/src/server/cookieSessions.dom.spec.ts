import { cookieApp } from "#test-support/cookieApp.ts";

cookieApp.it("sign-up and sign-in keep their cookie sessions against the PostgreSQL host", [], function* ({ signUp, signIn, signOut, sessionIs }) {
	yield* signUp();
	yield* sessionIs("alice@app.test");
	yield* signOut();
	yield* sessionIs(null);
	yield* signIn();
	yield* sessionIs("alice@app.test");
	yield* signOut();
	yield* sessionIs(null);
});
