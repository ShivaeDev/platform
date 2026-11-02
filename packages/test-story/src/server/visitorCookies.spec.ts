import { expect } from "vitest";
import { visitor, visitorApp } from "#test/visitorApp.ts";

visitorApp.it("keeps every app cookie, including HttpOnly, for the next request", [visitor("ada")], function* ({ as }) {
	yield* as("ada").receivesCookies(["session=ada; Path=/; HttpOnly", "theme=dark; Path=/"]);

	const answer = yield* as("ada").asks();

	expect(answer.cookies).toBe("session=ada; theme=dark");
});

visitorApp.it("keeps two visitors' sessions separate on the same app", [visitor("ada"), visitor("bob")], function* ({ as }) {
	yield* as("ada").receivesCookies(["session=ada; Path=/; HttpOnly"]);
	yield* as("bob").receivesCookies(["session=bob; Path=/; HttpOnly"]);

	const ada = yield* as("ada").asks();
	const bob = yield* as("bob").asks();

	expect([ada.cookies, bob.cookies]).toEqual(["session=ada", "session=bob"]);
});

visitorApp.it("sends Secure cookies only to HTTPS, including on localhost", [visitor("ada", { baseUrl: "https://localhost" })], function* ({ as }) {
	yield* as("ada").receivesCookies(["session=ada; Secure; Path=/", "theme=dark; Path=/"]);
	const secure = yield* as("ada").asks();
	expect(secure.cookies).toBe("session=ada; theme=dark");

	const insecure = yield* as("ada").asks("http://localhost/echo");

	expect(insecure.cookies).toBe("theme=dark");
});

visitorApp.it("ignores Secure cookies set over HTTP", [visitor("ada", { baseUrl: "http://app.example" })], function* ({ as }) {
	yield* as("ada").receivesCookies(["session=ada; Secure; Path=/", "theme=dark; Path=/"]);

	const answer = yield* as("ada").asks("https://app.example/echo");

	expect(answer.cookies).toBe("theme=dark");
});

visitorApp.it("replaces and deletes the app's session cookie", [visitor("ada")], function* ({ as }) {
	yield* as("ada").receivesCookies(["session=old; Path=/"]);
	const before = yield* as("ada").asks();
	expect(before.cookies).toBe("session=old");

	yield* as("ada").receivesCookies(["session=new; Path=/"]);
	const replaced = yield* as("ada").asks();
	expect(replaced.cookies).toBe("session=new");

	yield* as("ada").receivesCookies(["session=; Max-Age=0; Path=/"]);
	const deleted = yield* as("ada").asks();
	expect(deleted.cookies).toBe("");
});

visitorApp.it("expires cookies on the story clock with Max-Age taking precedence", [visitor("ada")], function* ({ as, timePasses }) {
	yield* as("ada").receivesCookies(["session=ada; Max-Age=30; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/"]);
	const before = yield* as("ada").asks();
	expect(before.cookies).toBe("session=ada");

	yield* timePasses(30);

	const expired = yield* as("ada").asks();
	expect(expired.cookies).toBe("");
});

visitorApp.it("removes a cookie when the app sets an expired Expires date", [visitor("ada")], function* ({ as }) {
	yield* as("ada").receivesCookies(["session=ada; Path=/"]);
	const before = yield* as("ada").asks();
	expect(before.cookies).toBe("session=ada");

	yield* as("ada").receivesCookies(["session=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/"]);

	const expired = yield* as("ada").asks();
	expect(expired.cookies).toBe("");
});

visitorApp.it("keeps same-name cookies at different paths and sends the most specific first", [visitor("ada")], function* ({ as }) {
	yield* as("ada").receivesCookies(["session=root; Path=/", "session=notes; Path=/notes"]);

	const notes = yield* as("ada").asks("/notes/echo");
	const elsewhere = yield* as("ada").asks("/notes-other");

	expect([notes.cookies, elsewhere.cookies]).toEqual(["session=notes; session=root", "session=root"]);
});

visitorApp.it("defaults cookie paths to the response directory", [visitor("ada")], function* ({ as }) {
	yield* as("ada").receivesCookies(["session=ada"], "/cookies/account");

	const inside = yield* as("ada").asks("/cookies/echo");
	const outside = yield* as("ada").asks("/echo");

	expect([inside.cookies, outside.cookies]).toEqual(["session=ada", ""]);
});

visitorApp.it("scopes host cookies and domain cookies and rejects another domain's cookies", [visitor("ada")], function* ({ as }) {
	yield* as("ada").receivesCookies(["host=ada; Path=/", "shared=yes; Domain=.app.example; Path=/", "foreign=no; Domain=elsewhere.test; Path=/"]);

	const sameHost = yield* as("ada").asks();
	const subdomain = yield* as("ada").asks("https://child.app.example/echo");
	const foreign = yield* as("ada").asks("https://elsewhere.test/echo");

	expect([sameHost.cookies, subdomain.cookies, foreign.cookies]).toEqual(["host=ada; shared=yes", "shared=yes", ""]);
});

visitorApp.it("returns redirects for the story to follow with the app's new cookie", [visitor("ada")], function* ({ as }) {
	const redirect = yield* as("ada").visitsRedirect();

	expect(redirect).toBe("HTTP 303 to /echo");

	const answer = yield* as("ada").asks();

	expect(answer.cookies).toBe("redirect=arrived");
});
