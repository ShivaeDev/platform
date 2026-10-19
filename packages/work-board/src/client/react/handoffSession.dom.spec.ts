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
	"puts handoff Schema messages on their fields when Prepare is pressed and saves nothing",
	[sessionScreen("handoff")],
	function* ({ input, submit, findElement, readText, readSessionFiles }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#handoff-submit")).toHaveProperty("disabled", false)));
		const recipient = input('[name="recipient"]', "x".repeat(201));
		const goal = input('[name="goal"]', " ");
		submit("#handoff-form");
		yield* Effect.promise(() => eventually(() => expect(goal.validationMessage).toContain("RegExp")));
		expect(recipient.validationMessage).toContain("200");
		expect(readText("#handoff-status")).toBe("Fill in the marked fields, then prepare the handoff.");
		expect(readSessionFiles("handoffs")).toEqual([]);
		input(goal, "Review the direction");
		input(recipient, "agent-local");
		yield* Effect.promise(() => eventually(() => expect([goal.validationMessage, recipient.validationMessage]).toEqual(["", ""])));
		expect(readText("#handoff-status")).toBe("");
	},
);

screenStory.it(
	"rebinds a draft to a changed source before preparing it",
	[sessionScreen("handoff")],
	function* ({ input, activate, submit, findElement, editSessionFile, readText, readSessionNavigation, readSessionFiles }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#handoff-submit")).toHaveProperty("disabled", false)));
		input('[name="recipient"]', "agent-local");
		const goal = input('[name="goal"]', "Keep my direction");
		editSessionFile("unrelated.md", "# Another file");
		yield* Effect.promise(() => waitFor(async () => expect((await readSessionNavigation()).counts.library).toBe(ITEM_AND_UNRELATED_FILE)));
		expect(findElement('[name="goal"]')).toBe(goal);
		expect(readText("#handoff-status")).toBe("");
		editSessionFile("item.md", `${EDGE_ATTENTION_SOURCE}Changed premise.\n`);
		yield* Effect.promise(() => eventually(() => expect(readText(".response-context")).toContain("Changed premise.")));
		expect(goal.value).toBe("Keep my direction");
		expect(readText("#handoff-status")).toContain("Source changed since this draft");
		submit("#handoff-form");
		yield* Effect.promise(() => eventually(() => expect(readText("#handoff-status")).toContain("Updated to the item's new version")));
		expect(readSessionFiles("handoffs")).toEqual([]);
		submit("#handoff-form");
		yield* Effect.promise(() => eventually(() => expect(readText("#handoff-status")).toContain("Saved handoffs/")));
		expect(readSessionFiles("handoffs").map((source) => source.includes("Changed premise."))).toEqual([true]);
		yield* Effect.promise(() => eventually(() => expect(findElement("#handoff-history article")).not.toBeNull()));
		yield* Effect.promise(() => activate("#handoff-prepared [data-handoff-copy]"));
		expect(readText("#handoff-status")).toBe("Copied. Paste it into your agent session.");
		expect(yield* Effect.promise(() => navigator.clipboard.readText())).toBe(findElement<HTMLTextAreaElement>("#handoff-prepared textarea")?.value);
	},
);

screenStory.it(
	"prepares a handoff without a preview, focuses its prompt and reports copying in one status line",
	[deniedClipboard(), sessionScreen("handoff")],
	function* ({ input, activate, submit, findElement, findElements, readText, readFocus }) {
		yield* Effect.promise(() => eventually(() => expect(findElement("#handoff-submit")).toHaveProperty("disabled", false)));
		input('[name="recipient"]', "agent-local");
		input('[name="goal"]', "Fix focus");
		findElement<HTMLButtonElement>("#handoff-submit")?.focus();
		submit("#handoff-form");
		yield* Effect.promise(() => eventually(() => expect(readText("#handoff-status")).toContain("Saved handoffs/")));
		expect(readText("#handoff-status")).toContain("Copy the prompt below into your agent session");
		const prompt = findElement<HTMLTextAreaElement>("#handoff-prepared textarea");
		yield* Effect.promise(() => eventually(() => expect(readFocus()).toBe(prompt)));
		expect(findElements("#handoff-form [role='status']").map((status) => status.id)).toEqual(["handoff-status"]);
		expect(findElement<HTMLInputElement>('[name="recipient"]')?.value).toBe("agent-local");
		const copy = findElement("#handoff-prepared [data-handoff-copy]");
		expect(copy?.classList.contains("bg-primary")).toBe(false);
		yield* Effect.promise(() => activate("#handoff-prepared [data-handoff-copy]"));
		expect(readText("#handoff-status")).toContain("selected");
		expect(prompt?.value).toContain("Record receipt");
		expect([prompt?.selectionStart, prompt?.selectionEnd]).toEqual([0, prompt?.value.length]);
		yield* Effect.promise(() => eventually(() => expect(findElement("#handoff-history article time[data-modified]")).not.toBeNull()));
		expect(readText("#handoff-history article header")).toMatch(/prepared \d+[smhd] ago/u);
	},
);
