import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { authReads, consentReadAnswered, consentReadIsOpen } from "#test/authQueryStories.tsx";

authReads.it("an answered auth read replaces Loading with its data", [consentReadIsOpen()], function* ({ authAnswers, shown }) {
	expect(yield* shown()).toBe("Loading");

	yield* authAnswers("Consent granted");

	expect(yield* shown()).toBe("Consent granted");
});

authReads.it("an error the auth client returns shows as the read's typed refusal", [consentReadIsOpen()], function* ({ authRefuses, shown }) {
	yield* authRefuses();

	expect(yield* shown()).toBe("refused: REFUSED (403)");
});

authReads.it("a rejected auth connection shows as auth unavailable with its reason", [consentReadIsOpen()], function* ({ connectionRejects, shown }) {
	yield* connectionRejects("offline");

	expect(yield* shown()).toBe("auth unavailable: offline");
});

authReads.it("closing the screen aborts its unanswered auth read", [consentReadIsOpen()], function* ({ closeScreen, consentRead }) {
	expect(yield* consentRead()).toBe("open");

	yield* closeScreen();

	expect(yield* consentRead()).toBe("aborted");
});

authReads.it(
	"showing the consent read again keeps its answer without another auth request",
	[consentReadAnswered("First consent")],
	function* ({ requestedInputs, showRead, shown }) {
		yield* showRead("consent");

		yield* outcomes({
			"requested inputs": [requestedInputs(), ["consent"]],
			shown: [shown(), "First consent"],
		});
	},
);

authReads.it("showing another input sends its own auth request", [consentReadAnswered("First consent")], function* ({ requestedInputs, showRead }) {
	expect(yield* requestedInputs()).toEqual(["consent"]);

	yield* showRead("another");

	expect(yield* requestedInputs()).toEqual(["consent", "another"]);
});
