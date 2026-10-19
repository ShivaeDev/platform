import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { waitFor } from "#test/live.ts";
import { deniedClipboard } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { sessionScreen } from "#test/sessionScreen.ts";

const ITEM_AND_UNRELATED_FILE = 2;

expectNoReactWarnings();
screenStory.it(
	"puts handoff Schema messages on their fields and clears corrections",
	[sessionScreen("handoff")],
	function* ({ input, activate, findElement }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#handoff-preview")).toHaveProperty("disabled", false)));
		const recipient = input('[name="recipient"]', "agent-local");
		const goal = input('[name="goal"]', " ");
		yield* Effect.promise(() => activate("#handoff-preview"));
		expect(goal.validationMessage).toContain("RegExp");
		expect(findElement("#handoff-submit")).toHaveProperty("disabled", true);
		input(goal, "Review the direction");
		input(recipient, "x".repeat(201));
		yield* Effect.promise(() => activate("#handoff-preview"));
		expect(goal.validationMessage).toBe("");
		expect(recipient.validationMessage).toContain("200");
		input(recipient, "agent-local");
		yield* Effect.promise(() => activate("#handoff-preview"));
		expect(recipient.validationMessage).toBe("");
		expect(findElement("#handoff-submit")).toHaveProperty("disabled", false);
	},
);

screenStory.it(
	"requires a new handoff preview when the reviewed source changes",
	[sessionScreen("handoff")],
	function* ({ input, activate, findElement, editSessionFile, readText, readSessionNavigation }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#handoff-preview")).toHaveProperty("disabled", false)));
		input('[name="recipient"]', "agent-local");
		const goal = input('[name="goal"]', "Keep my direction");
		editSessionFile("unrelated.md", "# Another file");
		yield* Effect.promise(() => waitFor(async () => expect((await readSessionNavigation()).counts.library).toBe(ITEM_AND_UNRELATED_FILE)));
		expect(findElement('[name="goal"]')).toBe(goal);
		yield* Effect.promise(() => activate("#handoff-preview"));
		expect(findElement("#handoff-submit")).toHaveProperty("disabled", false);
		editSessionFile("item.md", `${EDGE_ATTENTION_SOURCE}Changed premise.\n`);
		yield* Effect.promise(() => eventually(() => expect(readText(".response-context")).toContain("Changed premise.")));
		expect(findElement('[name="goal"]')).toBe(goal);
		expect(goal.value).toBe("Keep my direction");
		expect(readText("#handoff-status")).toContain("Source changed since this draft");
		expect(findElement("#handoff-submit")).toHaveProperty("disabled", true);
		yield* Effect.promise(() => activate("#handoff-preview"));
		expect(findElement("#handoff-submit")).toHaveProperty("disabled", false);
	},
);

screenStory.it(
	"prepares a handoff and selects its prompt for manual copying without a clipboard",
	[deniedClipboard(), sessionScreen("handoff")],
	function* ({ input, activate, submit, findElement, readText }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#handoff-preview")).toHaveProperty("disabled", false)));
		input('[name="recipient"]', "agent-local");
		input('[name="goal"]', "Fix focus");
		yield* Effect.promise(() => activate("#handoff-preview"));
		submit("#handoff-form");
		yield* Effect.promise(() => eventually(() => expect(readText("#handoff-status")).toContain("Prepared:")));
		expect(readText("#handoff-status")).toContain("execution and acceptance remain separate");
		yield* Effect.promise(() => activate("#handoff-prepared [data-handoff-copy]"));
		expect(readText("#handoff-prepared [data-copy-status]")).toContain("selected");
		const prompt = findElement<HTMLTextAreaElement>("#handoff-prepared textarea");
		expect(prompt?.value).toContain("Record receipt");
		expect([prompt?.selectionStart, prompt?.selectionEnd]).toEqual([0, prompt?.value.length]);
	},
);
