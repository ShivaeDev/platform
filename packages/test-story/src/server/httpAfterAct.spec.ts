import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { scopedHttpApp } from "#test/scopedHttpApp.ts";

const PULL_COMMENTS = "/repos/team/platform/pulls/7/comments";

const FAULTS = [
	[
		"status",
		{ kind: "status", reply: { body: { error: "try later" }, status: HttpStatus.fromLiteral("ServiceUnavailable") } },
		'HTTP 503 {"error":"try later"}',
		"503",
	],
	["drop", { kind: "drop" }, "connection reset", "unanswered"],
	["reset", { kind: "reset" }, "HTTP 201, then connection reset", "unanswered"],
] as const;

for (const [kind, fault, answer, record] of FAULTS) {
	scopedHttpApp.it(
		`answers a comment with the ${kind} fault scripted after its reply and records it as ${record}`,
		[],
		function* ({ answer: answerOf, requests, scriptFault, sends }) {
			yield* scriptFault("comment", fault, { params: { number: "7" }, phase: "after" });

			yield* sends("first comment", PULL_COMMENTS, { body: "first comment", method: "POST" });

			yield* outcomes({
				answer: [answerOf("first comment"), answer],
				requests: [requests(), [`POST ${PULL_COMMENTS} ${record}`]],
			});
		},
	);

	scopedHttpApp.it(`applies a comment before the ${kind} fault scripted after its reply`, [], function* ({ asks, comments, scriptFault }) {
		yield* scriptFault("comment", fault, { params: { number: "7" }, phase: "after" });

		yield* asks(PULL_COMMENTS, { body: "first comment", method: "POST" });

		expect(yield* comments()).toEqual(["pull 7: first comment"]);
	});

	scopedHttpApp.it(`answers the next comment normally once a one-shot ${kind} fault after the reply is spent`, [], function* ({ asks, scriptFault }) {
		yield* scriptFault("comment", fault, { params: { number: "7" }, phase: "after" });

		yield* outcomes({
			"the first comment": [asks(PULL_COMMENTS, { body: "first comment", method: "POST" }), answer],
			"the second comment": [asks(PULL_COMMENTS, { body: "second comment", method: "POST" }), 'HTTP 201 {"pull":"7","text":"second comment"}'],
		});
	});
}

scopedHttpApp.it(
	"answers a comment with a fault scripted before its reply and leaves the comment unapplied",
	[],
	function* ({ answer, comments, scriptFault, sends }) {
		yield* scriptFault("comment", { kind: "status", reply: { status: HttpStatus.fromLiteral("ServiceUnavailable") } });

		yield* sends("lost comment", PULL_COMMENTS, { body: "not created", method: "POST" });

		yield* outcomes({
			answer: [answer("lost comment"), "HTTP 503"],
			comments: [comments(), []],
		});
	},
);
