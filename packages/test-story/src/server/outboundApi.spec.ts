import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { fakeHttpApp, type HttpPage, hasCredential, publicHttpApp } from "#test/fakeHttpApp.ts";

fakeHttpApp.it(
	"answers each path parameter over real HTTP and rejects unmatched routes",
	[hasCredential("Bearer story-key")],
	function* ({ request }) {
		expect(yield* request("/users/alice")).toMatchObject({ body: { id: "alice" }, status: 200 });
		expect(yield* request("/users/bob%20smith")).toMatchObject({ body: { id: "bob smith" }, status: 200 });
		expect(yield* request("/users/alice/extra")).toMatchObject({ status: 404 });
		expect(yield* request("/users/alice", { method: "POST" })).toMatchObject({ status: 404 });
	},
);

fakeHttpApp.it(
	"rejects missing and wrong credentials before consuming a scripted failure",
	[hasCredential("Bearer story-key")],
	function* ({ failOnce, request }) {
		yield* failOnce("user", { status: 502 });
		expect(yield* request("/users/alice", { headers: {} })).toMatchObject({ status: 401 });
		expect(yield* request("/users/alice", { headers: { authorization: "Bearer wrong" } })).toMatchObject({ status: 401 });
		expect(yield* request("/users/alice")).toMatchObject({ status: 502 });
		expect(yield* request("/users/alice")).toMatchObject({ body: { id: "alice" }, status: 200 });
	},
);

fakeHttpApp.it(
	"rejects an unauthenticated request without entering or releasing a hold",
	[hasCredential("Bearer story-key")],
	function* ({ hold, request }) {
		const paused = yield* hold("user");
		const waiting = yield* Effect.forkChild(paused.waiting);
		expect(yield* request("/users/alice", { headers: {} })).toMatchObject({ status: 401 });
		expect(waiting.pollUnsafe()).toBeUndefined();
		const pending = yield* Effect.forkChild(request("/users/alice"));
		yield* Fiber.join(waiting);
		expect(yield* request("/items")).toMatchObject({ status: 200 });
		expect(pending.pollUnsafe()).toBeUndefined();
		yield* paused.release;
		expect(yield* Fiber.join(pending)).toMatchObject({ body: { id: "alice" }, status: 200 });
	},
);

fakeHttpApp.it(
	"logs malformed path parameters, rejects them with 400 and keeps serving",
	[hasCredential("Bearer story-key")],
	function* ({ request, requests, story }) {
		expect(yield* request("/users/%?source=story")).toMatchObject({ status: 400 });
		expect(yield* request("/users/alice")).toMatchObject({ body: { id: "alice" }, status: 200 });
		expect(requests()).toEqual([
			{ body: "", method: "GET", path: "/users/%?source=story" },
			{ body: "", method: "GET", path: "/users/alice" },
		]);
		expect(story.lines).toEqual([
			"the caller has an API credential",
			"fake HTTP received GET /users/%?source=story",
			"fake HTTP rejected GET /users/%?source=story with 400",
			"fake HTTP received GET /users/alice",
			"fake HTTP answered GET /users/alice with 200",
		]);
	},
);

fakeHttpApp.it("walks every page and reaches the end", [hasCredential("Bearer story-key")], function* ({ readPage, request, requests }) {
	const items: string[] = [];
	let next: number | null = 1;
	for (let count = 0; count < 3 && next !== null; count += 1) {
		const page: HttpPage = yield* readPage(next);
		items.push(...page.items);
		next = page.next;
	}
	expect(next).toBeNull();
	expect(items).toEqual(["paper", "ink", "pens", "staples"]);
	expect(requests().map(({ path }) => path)).toEqual(["/items", "/items?page=2", "/items?page=3"]);
	expect(yield* request("/items?page=4")).toMatchObject({ body: { items: [], next: null }, status: 200 });
	for (const page of ["0", "-1", "1.5", "wrong"]) {
		expect(yield* request(`/items?page=${page}`)).toMatchObject({ status: 400 });
	}
});

fakeHttpApp.it("fails one route exactly once and then answers normally", [hasCredential("Bearer story-key")], function* ({ failOnce, request }) {
	yield* failOnce("user", { body: { error: "try again" }, headers: { "retry-after": "1" }, status: 502 });
	expect(yield* request("/items")).toMatchObject({ status: 200 });
	expect(yield* request("/users/alice")).toMatchObject({ body: { error: "try again" }, headers: { "retry-after": "1" }, status: 502 });
	expect(yield* request("/users/alice")).toMatchObject({ body: { id: "alice" }, status: 200 });
	expect(yield* request("/users/bob")).toMatchObject({ body: { id: "bob" }, status: 200 });
});

fakeHttpApp.it(
	"keeps a request waiting until release while other routes answer",
	[hasCredential("Bearer story-key")],
	function* ({ hold, request, requests, story }) {
		const paused = yield* hold("user");
		const pending = yield* Effect.forkChild(request("/users/alice"));
		yield* paused.waiting;
		expect(pending.pollUnsafe()).toBeUndefined();
		expect(requests()).toEqual([{ body: "", method: "GET", path: "/users/alice" }]);
		expect(yield* request("/items")).toMatchObject({ status: 200 });
		expect(pending.pollUnsafe()).toBeUndefined();
		yield* paused.release;
		expect(yield* Fiber.join(pending)).toMatchObject({ body: { id: "alice" }, status: 200 });
		expect(yield* request("/users/bob")).toMatchObject({ body: { id: "bob" }, status: 200 });
		expect(story.lines).toEqual([
			"the caller has an API credential",
			"fake HTTP user held",
			"fake HTTP received GET /users/alice",
			"fake HTTP user has a waiting request",
			"fake HTTP received GET /items",
			"fake HTTP answered GET /items with 200",
			"fake HTTP user released",
			"fake HTTP answered GET /users/alice with 200",
			"fake HTTP received GET /users/bob",
			"fake HTTP answered GET /users/bob with 200",
		]);
	},
);

fakeHttpApp.it(
	"reads method, path and body in request order, including rejected requests",
	[hasCredential("Bearer story-key")],
	function* ({ request, requests }) {
		expect(yield* request("/messages?source=story", { body: '{"message":"hello"}', method: "POST" })).toMatchObject({ status: 201 });
		yield* request("/users/alice");
		yield* request("/messages", { body: "wrong credential", headers: {}, method: "POST" });
		expect(requests()).toEqual([
			{ body: '{"message":"hello"}', method: "POST", path: "/messages?source=story" },
			{ body: "", method: "GET", path: "/users/alice" },
			{ body: "wrong credential", method: "POST", path: "/messages" },
		]);
	},
);

fakeHttpApp.it("closes the real listener when its scope ends", [hasCredential("Bearer story-key")], function* ({ close, request, url }) {
	const address = url();
	expect(yield* request("/users/alice")).toMatchObject({ body: { id: "alice" }, status: 200 });
	yield* close();
	yield* Effect.promise(() => expect(fetch(`${address}/users/alice`)).rejects.toThrow());
});

publicHttpApp.it("serves a public API when no guard is supplied", [], function* ({ request }) {
	expect(yield* request("/users/alice", { headers: {} })).toMatchObject({ body: { id: "alice" }, status: 200 });
});
