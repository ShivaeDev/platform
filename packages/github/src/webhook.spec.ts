import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { appGithub, exchangeRefused } from "#test/appGithub.ts";

appGithub.it("a signed workflow_run delivery is decoded once with the caller's Schema", [], function* ({ bodiesDecoded, receive, receiverAnswered }) {
	yield* receive("a signed delivery");

	yield* outcomes({
		"bodies decoded": [bodiesDecoded(), 1],
		"receiver answered": [receiverAnswered(), { action: "completed", workflowRun: { conclusion: "success", id: 42 } }],
	});
});

for (const delivery of ["a tampered body", "the wrong secret", "a missing signature header", "a malformed signature header"] as const) {
	appGithub.it(
		`a delivery with ${delivery} fails as signature rejected without decoding the body`,
		[],
		function* ({ bodiesDecoded, receive, receiverAnswered }) {
			yield* receive(delivery);

			yield* outcomes({
				"bodies decoded": [bodiesDecoded(), 0],
				"receiver answered": [receiverAnswered(), "signature rejected"],
			});
		},
	);
}

appGithub.it("verifying only the signature accepts signed bytes that are not JSON", [], function* ({ receiveUndecoded }) {
	expect(yield* receiveUndecoded(Buffer.from("not-json"))).toBe("verified");
});

appGithub.it(
	"a token exchange GitHub refuses while echoing every credential records its span but keeps every credential out of failures, logs and spans",
	[exchangeRefused],
	function* ({ credentialsSeenIn, readPull, spanNames }) {
		yield* readPull();

		yield* outcomes({
			"credentials seen in": [credentialsSeenIn(), {}],
			"spans recorded": [spanNames(), expect.arrayContaining(["GitHub App operation"])],
		});
	},
);

appGithub.it(
	"a successful installation read records its span but keeps every credential out of failures, logs and spans",
	[],
	function* ({ credentialsSeenIn, readPull, spanNames }) {
		yield* readPull();

		yield* outcomes({
			"credentials seen in": [credentialsSeenIn(), {}],
			"spans recorded": [spanNames(), expect.arrayContaining(["GitHub App operation"])],
		});
	},
);

appGithub.it(
	"signing an App JWT with an invalid private key records its span but keeps every credential out of failures, logs and spans",
	[],
	function* ({ credentialsSeenIn, readWithInvalidKey, spanNames }) {
		yield* readWithInvalidKey();

		yield* outcomes({
			"credentials seen in": [credentialsSeenIn(), {}],
			"spans recorded": [spanNames(), expect.arrayContaining(["GitHub App operation"])],
		});
	},
);

appGithub.it(
	"a delivery verified with the wrong secret records its span but keeps every credential out of failures, logs and spans",
	[],
	function* ({ credentialsSeenIn, receive, spanNames }) {
		yield* receive("the wrong secret");

		yield* outcomes({
			"credentials seen in": [credentialsSeenIn(), {}],
			"spans recorded": [spanNames(), expect.arrayContaining(["GitHub App operation"])],
		});
	},
);
