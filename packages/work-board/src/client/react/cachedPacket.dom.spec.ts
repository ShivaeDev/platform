import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { screenStory } from "#test/screenStory.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";
import { sessionScreen } from "#test/sessionScreen.ts";

expectNoReactWarnings();
screenStory.it(
	"rebinds a cached packet without duplicate labels or stale warnings",
	[
		screenFiles({ "home.md": "# Home", "proposal.md": questionnaireSource }, { home: "home.md" }),
		screenRoute("/_board/item/investigation.choices/"),
		sessionScreen("response"),
	],
	function* ({ input, activate, submit, findElement, findElements, restoreSession, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
		input('[data-prompt="display"] textarea', "Keep history.");
		submit("#response-form");
		expect(readText("#response-status")).toContain("Unanswered");
		restoreSession();
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-preview")).toHaveProperty("disabled", false)));
		input('[data-prompt="checks"] textarea', "Keyboard checks.");
		yield* Effect.promise(() => activate("#response-preview"));
		expect(findElements(".response-field-error:not([hidden])")).toHaveLength(0);
		const messages = findElements(".response-field-error");
		expect(new Set(messages.map((message) => message.id)).size).toBe(messages.length);
		expect(readText("#response-status")).not.toContain("Unanswered");
	},
);
