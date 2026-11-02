import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { maskedFailures } from "#test/app-host/maskedFailures.ts";
import { host } from "#test/app-host/story.ts";

for (const shape of ["request", "stream"] as const) {
	for (const interrupt of [false, true]) {
		host.it(
			`a masked declared ${shape} failure${interrupt ? " alongside an interruption" : ""} decodes as its declared class with schema-compatible secret-free fields`,
			[maskedFailures],
			function* ({ receiveMaskedFailure, receiveMaskedStream }) {
				const answer = yield* shape === "stream" ? receiveMaskedStream(interrupt) : receiveMaskedFailure(interrupt);

				expect(answer).toEqual({
					cancelled: interrupt,
					rejection: "MaskedRejection",
					value: {
						_tag: "MaskedRejection",
						active: false,
						count: 0,
						encoded: 1,
						items: [],
						message: "Cannot save",
						nil: null,
						positive: 1,
						profile: { age: 0, city: "<redacted>" },
					},
				});
			},
		);
	}
}

host.it("masked declared failure fields carry no secrets on the HTTP wire", [maskedFailures], function* ({ answerMentions, callRpc, wireAnswers }) {
	yield* callRpc("maskedFailure", { interrupt: false });

	yield* outcomes([
		[
			"failure",
			() => wireAnswers(),
			{
				"1": {
					failed: expect.objectContaining({ _tag: "MaskedRejection", count: 0, items: [], positive: 1, profile: { age: 0, city: "<redacted>" } }),
				},
			},
		],
		["leaked into the answer", () => answerMentions("987654321", "456789", "987123", "private item", "private city"), []],
	]);
});

host.it("a masked null root decodes as the declared failure", [maskedFailures], function* ({ receiveMaskedNull }) {
	const answer = yield* receiveMaskedNull();

	expect(answer).toEqual({ cancelled: false, rejection: "masked null" });
});
