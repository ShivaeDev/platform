import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { acquisitionHttpApp, fakeHttpApp, hasCredential, publicHttpApp } from "#test/fakeHttpApp.ts";

const MEMBER = hasCredential("Bearer story-key");

acquisitionHttpApp.it("tells the story through the callback it was given when acquired", [], function* ({ asks, story }) {
	yield* asks("/users/alice");

	expect(story.lines).toEqual([
		"the client asks for GET /users/alice",
		"fake HTTP received GET /users/alice",
		"fake HTTP answered GET /users/alice with 200",
	]);
});

fakeHttpApp.it("tells a scripted failure, a rejection and the answer that spends the failure", [MEMBER], function* ({ asks, failOnce, story }) {
	yield* failOnce("user", { status: HttpStatus.fromLiteral("BadGateway") });
	yield* asks("/users/alice", { headers: { authorization: "Bearer wrong" } });

	yield* asks("/users/alice");

	expect(story.lines).toEqual([
		"the caller has an API credential",
		"fake HTTP user will answer once with 502",
		"the client asks for GET /users/alice",
		"fake HTTP received GET /users/alice",
		"fake HTTP rejected GET /users/alice with 401",
		"the client asks for GET /users/alice",
		"fake HTTP received GET /users/alice",
		"fake HTTP answered GET /users/alice with 502",
	]);
});

fakeHttpApp.it("tells a malformed path parameter as a rejection with 400", [MEMBER], function* ({ asks, story }) {
	yield* asks("/users/%?source=story");

	expect(story.lines).toEqual([
		"the caller has an API credential",
		"the client asks for GET /users/%?source=story",
		"fake HTTP received GET /users/%?source=story",
		"fake HTTP rejected GET /users/%?source=story with 400",
	]);
});

publicHttpApp.it("keeps headers, credentials and body out of what it tells", [], function* ({ asks, story }) {
	yield* asks("/messages?source=story", {
		body: "private message body",
		headers: { authorization: "Bearer story-key", "x-private-header": "private header value" },
		method: "POST",
	});

	expect(story.lines).toEqual([
		"the client asks for POST /messages?source=story",
		"fake HTTP received POST /messages?source=story",
		"fake HTTP answered POST /messages?source=story with 201",
	]);
});

for (const [method, path] of [
	["GET", "/missing"],
	["POST", "/users/alice"],
] as const) {
	fakeHttpApp.it(`tells an unmatched ${method} ${path} as answered with 404`, [MEMBER], function* ({ asks, story }) {
		yield* asks(path, { method });

		expect(story.lines).toEqual([
			"the caller has an API credential",
			`the client asks for ${method} ${path}`,
			`fake HTTP received ${method} ${path}`,
			`fake HTTP answered ${method} ${path} with 404`,
		]);
	});
}

fakeHttpApp.it("tells a hold, its waiting request and its release", [MEMBER], function* ({ answer, hold, sends, story }) {
	const paused = yield* hold("user");
	yield* sends("alice's request", "/users/alice");
	yield* paused.waiting;

	yield* paused.release;

	yield* answer("alice's request");
	expect(story.lines).toEqual([
		"the caller has an API credential",
		"fake HTTP user held",
		"alice's request sends GET /users/alice",
		"fake HTTP received GET /users/alice",
		"fake HTTP user has a waiting request",
		"fake HTTP user released",
		"fake HTTP answered GET /users/alice with 200",
	]);
});
