import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { fakeHttpApp, hasCredential, publicHttpApp } from "#test/fakeHttpApp.ts";

const MEMBER = hasCredential("Bearer story-key");

for (const [method, path, answer] of [
	["GET", "/users/alice", 'HTTP 200 {"id":"alice"}'],
	["GET", "/users/bob%20smith", 'HTTP 200 {"id":"bob smith"}'],
	["GET", "/users/alice/extra", "HTTP 404"],
	["POST", "/users/alice", "HTTP 404"],
] as const) {
	fakeHttpApp.it(`answers ${method} ${path} with ${answer}`, [MEMBER], function* ({ asks }) {
		expect(yield* asks(path, { method })).toBe(answer);
	});
}

for (const [credential, headers] of [
	["no credential", {}],
	["a wrong credential", { authorization: "Bearer wrong" }],
] as const) {
	fakeHttpApp.it(`rejects a request with ${credential} before it can take a scripted failure`, [MEMBER], function* ({ asks, scriptFault }) {
		yield* scriptFault("user", { kind: "status", reply: { status: HttpStatus.fromLiteral("BadGateway") } });

		yield* outcomes({
			"a rejected request": [asks("/users/alice", { headers }), "HTTP 401"],
			"the next member request": [asks("/users/alice"), "HTTP 502"],
		});
	});
}

fakeHttpApp.it("rejects an unauthenticated request before it reaches a hold", [MEMBER], function* ({ asks, hold }) {
	yield* hold("user");

	expect(yield* asks("/users/alice", { headers: {} })).toBe("HTTP 401");
});

fakeHttpApp.it("keeps a held request waiting until release while other routes answer", [MEMBER], function* ({ answer, asks, hold, progress, sends }) {
	const paused = yield* hold("user");
	yield* sends("alice's request", "/users/alice");
	yield* paused.waiting;
	yield* outcomes({
		"the items": [asks("/items"), 'HTTP 200 {"items":["paper","ink"],"next":2}'],
		"while alice's request": [progress("alice's request"), "waiting for an answer"],
	});

	yield* paused.release;

	expect(yield* answer("alice's request")).toBe('HTTP 200 {"id":"alice"}');
});

fakeHttpApp.it("rejects a malformed path parameter with 400 and keeps serving", [MEMBER], function* ({ asks }) {
	yield* outcomes({
		"the malformed request": [asks("/users/%?source=story"), "HTTP 400"],
		"the next request": [asks("/users/alice"), 'HTTP 200 {"id":"alice"}'],
	});
});

for (const [path, answer] of [
	["/items", 'HTTP 200 {"items":["paper","ink"],"next":2}'],
	["/items?page=2", 'HTTP 200 {"items":["pens"],"next":3}'],
	["/items?page=3", 'HTTP 200 {"items":["staples"],"next":null}'],
	["/items?page=4", 'HTTP 200 {"items":[],"next":null}'],
	["/items?page=0", 'HTTP 400 {"error":"page must be a positive integer"}'],
	["/items?page=-1", 'HTTP 400 {"error":"page must be a positive integer"}'],
	["/items?page=1.5", 'HTTP 400 {"error":"page must be a positive integer"}'],
	["/items?page=wrong", 'HTTP 400 {"error":"page must be a positive integer"}'],
] as const) {
	fakeHttpApp.it(`answers the paged route's ${path} with ${answer}`, [MEMBER], function* ({ asks }) {
		expect(yield* asks(path)).toBe(answer);
	});
}

fakeHttpApp.it(
	"answers a route's next request with its scripted failure, headers included",
	[MEMBER],
	function* ({ answer, asks, scriptFault, header, sends }) {
		yield* scriptFault("user", {
			kind: "status",
			reply: { body: { error: "try again" }, headers: { "retry-after": "1" }, status: HttpStatus.fromLiteral("BadGateway") },
		});
		expect(yield* asks("/items")).toBe('HTTP 200 {"items":["paper","ink"],"next":2}');

		yield* sends("alice's request", "/users/alice");

		yield* outcomes({
			answer: [answer("alice's request"), 'HTTP 502 {"error":"try again"}'],
			"retry-after": [header("alice's request", "retry-after"), "1"],
		});
	},
);

fakeHttpApp.it("answers a route normally once its scripted failure is spent", [MEMBER], function* ({ asks, scriptFault }) {
	yield* scriptFault("user", { kind: "status", reply: { status: HttpStatus.fromLiteral("BadGateway") } });

	yield* outcomes({
		"the first request": [asks("/users/alice"), "HTTP 502"],
		"the next request": [asks("/users/bob"), 'HTTP 200 {"id":"bob"}'],
	});
});

fakeHttpApp.it("records each request's method, path and body in arrival order, rejected ones included", [MEMBER], function* ({ asks, received }) {
	yield* asks("/messages?source=story", { body: '{"message":"hello"}', method: "POST" });
	yield* asks("/users/alice");
	yield* asks("/messages", { body: "wrong credential", headers: {}, method: "POST" });

	expect(yield* received()).toEqual(['POST /messages?source=story "{"message":"hello"}"', "GET /users/alice", 'POST /messages "wrong credential"']);
});

fakeHttpApp.it("stops listening once its scope closes", [MEMBER], function* ({ asks, closesService }) {
	expect(yield* asks("/users/alice")).toBe('HTTP 200 {"id":"alice"}');

	yield* closesService();

	expect(yield* asks("/users/alice")).toBe("connection refused");
});

publicHttpApp.it("serves a request without credentials when the service has no guard", [], function* ({ asks }) {
	expect(yield* asks("/users/alice", { headers: {} })).toBe('HTTP 200 {"id":"alice"}');
});
