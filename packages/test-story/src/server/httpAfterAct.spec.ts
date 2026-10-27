import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { scopedHttpApp } from "#test/scopedHttpApp.ts";

for (const kind of ["status", "drop", "reset"] as const) {
	scopedHttpApp.it(
		`applies a comment before a one-shot ${kind} fault reaches the client`,
		[],
		function* ({ scriptFault, request, comments, requests }) {
			yield* scriptFault(
				"comment",
				kind === "status" ? { kind, reply: { body: { error: "try later" }, status: HttpStatus.fromLiteral("ServiceUnavailable") } } : { kind },
				{
					params: { number: "7" },
					phase: "after",
				},
			);
			const client = yield* request("/repos/team/platform/pulls/7/comments", { body: "first comment", method: "POST" });
			if (kind === "status") {
				expect(yield* client.headers).toMatchObject({ status: HttpStatus.fromLiteral("ServiceUnavailable") });
				expect(yield* client.finished).toEqual({ bytes: Buffer.from('{"error":"try later"}'), kind: "complete" });
			} else {
				expect(yield* client.headers).toMatchObject(
					kind === "drop" ? { code: "ECONNRESET", kind: "error" } : { status: HttpStatus.fromLiteral("Created") },
				);
				expect(yield* client.finished).toMatchObject({ code: "ECONNRESET", kind: "error" });
			}
			expect(requests()).toContain(
				`POST /repos/team/platform/pulls/7/comments ${kind === "status" ? HttpStatus.fromLiteral("ServiceUnavailable") : "unanswered"}`,
			);
			expect(yield* comments()).toEqual([{ pull: "7", text: "first comment" }]);
			const next = yield* request("/repos/team/platform/pulls/7/comments", { body: "second comment", method: "POST" });
			expect(yield* next.headers).toMatchObject({ status: HttpStatus.fromLiteral("Created") });
			expect(yield* comments()).toEqual([
				{ pull: "7", text: "first comment" },
				{ pull: "7", text: "second comment" },
			]);
		},
	);
}

scopedHttpApp.it(
	"leaves the route's effect unapplied when a fault strikes before its reply",
	[],
	function* ({ scriptFault, request, comments, requests }) {
		yield* scriptFault("comment", { kind: "status", reply: { status: HttpStatus.fromLiteral("ServiceUnavailable") } });
		const client = yield* request("/repos/team/platform/pulls/7/comments", { body: "not created", method: "POST" });
		expect(yield* client.headers).toMatchObject({ status: HttpStatus.fromLiteral("ServiceUnavailable") });
		expect(yield* client.finished).toMatchObject({ kind: "complete" });
		expect(requests()).toContain("POST /repos/team/platform/pulls/7/comments 503");
		expect(yield* comments()).toEqual([]);
	},
);
