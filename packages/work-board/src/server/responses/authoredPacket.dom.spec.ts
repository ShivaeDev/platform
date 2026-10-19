import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { questionnaireSource } from "#test/questionnaire.ts";
import { screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";
import { storedScreenState } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();
const source = questionnaireSource.replace(
	"### How should replies appear?",
	'### How should replies appear?\n\n<form id="forged"><input name="author"></form>\n\n<script>globalThis.authoredPacketRan = true</script>\n',
);
screenStory.it(
	"keeps authored form and script markup outside live packet controls",
	[
		screenWorkspace("authored-packet"),
		storedScreenState({ "work-board:author:authored-packet": "Reviewer" }),
		routedScreen({ "proposal.md": source }, "/_board/item/investigation.choices/", { home: undefined, writable: true }),
	],
	function* ({ findElement, input, submit, readResponses, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#response-form")).not.toBeNull()));
		expect(findElement("#response-form #forged")).toBeNull();
		expect(findElement("#response-form script")).toBeNull();
		expect(readText("#response-form")).not.toContain("<form");
		expect(readText("#response-form")).not.toContain("globalThis.authoredPacketRan");
		input('#response-form [data-prompt="display"] textarea', "Keep the history.");
		input('#response-form [data-prompt="checks"] textarea', "Test keyboard use.");
		submit("#response-form");
		yield* Effect.promise(() => eventually(() => expect(readText("#response-status")).toContain("Saved:")));
		const saved = yield* Effect.promise(() => readResponses("investigation.choices", "direction"));
		expect(saved.responses[0]?.response.author).toBe("Reviewer");
	},
);
