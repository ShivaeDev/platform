import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
screenStory.it(
	"puts each missing prompt warning beside its own control and clears corrections",
	[routedScreen({ "proposal.md": questionnaireSource }, "/_board/item/investigation.choices/", { home: undefined, writable: true })],
	function* ({ findElement, input, activate, submit, readText, check, readFocus }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
		check("history");
		yield* Effect.promise(() => activate("#response-preview"));
		const display = findElement<HTMLTextAreaElement>('[data-prompt="display"] textarea');
		const checks = findElement<HTMLTextAreaElement>('[data-prompt="checks"] textarea');
		expect([display?.validationMessage, checks?.validationMessage]).toEqual(["", ""]);
		submit("#response-form");
		expect(checks?.validationMessage).toBe("Choose an option or answer in your own words.");
		yield* Effect.promise(() => eventually(() => expect(readFocus()).toBe(checks)));
		input(checks, "Test keyboard use");
		expect(checks?.validationMessage).toBe("");
		input(checks, "");
		yield* Effect.promise(() => activate("#response-preview"));
		expect(readText('[data-prompt="checks"] .response-field-error')).toContain("Unanswered: “Which checks matter?”");
		input(checks, "Test keyboard use");
		expect(readText("#response-status")).not.toContain("Unanswered");
		expect(findElement("#response-submit")).toHaveProperty("disabled", false);
	},
);
