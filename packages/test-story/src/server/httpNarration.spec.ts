import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { acquisitionHttpApp, fakeHttpApp, hasCredential } from "#test/fakeHttpApp.ts";

acquisitionHttpApp.it("narrates through the callback supplied at acquisition", [], function* ({ request, story }) {
	expect(yield* request("/users/alice")).toMatchObject({ body: { id: "alice" }, status: HttpStatus.fromLiteral("OK") });
	expect(story.lines).toEqual(["fake HTTP received GET /users/alice", "fake HTTP answered GET /users/alice with 200"]);
});

fakeHttpApp.it("narrates rejections and one-shot reply controls", [hasCredential("Bearer story-key")], function* ({ scriptFault, request, story }) {
	yield* scriptFault("user", { kind: "status", reply: { status: HttpStatus.fromLiteral("BadGateway") } });
	expect(yield* request("/users/alice", { headers: { authorization: "Bearer wrong" } })).toMatchObject({
		status: HttpStatus.fromLiteral("Unauthorized"),
	});
	expect(yield* request("/users/alice")).toMatchObject({ status: HttpStatus.fromLiteral("BadGateway") });
	expect(yield* request("/users/alice")).toMatchObject({ status: HttpStatus.fromLiteral("OK") });
	expect(story.lines).toEqual([
		"the caller has an API credential",
		"fake HTTP user will fault status before reply once",
		"fake HTTP received GET /users/alice",
		"fake HTTP rejected GET /users/alice with 401",
		"fake HTTP received GET /users/alice",
		"fake HTTP answered GET /users/alice with 502",
		"fake HTTP received GET /users/alice",
		"fake HTTP answered GET /users/alice with 200",
	]);
});

fakeHttpApp.it("keeps headers, credentials and body out of normal request narration", [], function* ({ request, story }) {
	expect(
		yield* request("/messages?source=story", {
			body: "private message body",
			headers: { authorization: "Bearer story-key", "x-private-header": "private header value" },
			method: "POST",
		}),
	).toMatchObject({ status: HttpStatus.fromLiteral("Created") });
	expect(story.lines).toEqual(["fake HTTP received POST /messages?source=story", "fake HTTP answered POST /messages?source=story with 201"]);
});

fakeHttpApp.it("narrates unmatched path and method replies", [hasCredential("Bearer story-key")], function* ({ request, story }) {
	expect(yield* request("/missing")).toMatchObject({ status: HttpStatus.fromLiteral("NotFound") });
	expect(yield* request("/users/alice", { method: "POST" })).toMatchObject({ status: HttpStatus.fromLiteral("NotFound") });
	expect(story.lines).toEqual([
		"the caller has an API credential",
		"fake HTTP received GET /missing",
		"fake HTTP answered GET /missing with 404",
		"fake HTTP received POST /users/alice",
		"fake HTTP answered POST /users/alice with 404",
	]);
});
