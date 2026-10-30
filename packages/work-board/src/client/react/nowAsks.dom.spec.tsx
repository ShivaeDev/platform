import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { nowAsksFixture } from "#test/nowAsksFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"puts a task with an open ask for the reader in Waiting on you, and leaves agent asks and related questions queued",
	[routedScreen(nowAsksFixture, "/_board/work", { home: "home.md" })],
	function* ({ findElement, findElements, readAttribute, readText }) {
		const waiting = "[aria-label='Waiting on you'] [data-item='task.yours']";
		yield* eventually(() => expect(findElement(waiting)).not.toBeNull());
		expect(readText(`${waiting} .work-owner`)).toBe("Waiting on your answer");
		expect(readAttribute(`${waiting} [data-status-token]`, "data-status-token")).toBe("needs-you");
		expect(
			[...findElements("[aria-label='Queued'] [data-item]")]
				.map((card) => card.getAttribute("data-item") ?? "")
				.toSorted((left, right) => left.localeCompare(right)),
		).toEqual(["task.agent", "task.related"]);
	},
);

for (const [task, chip] of [
	["task.yours", "Needs you"],
	["task.agent", "Waiting on automation"],
] as const) {
	screenStory.it(
		`splits the header chip of ${task} by who answers its open ask, like Now and Today`,
		[routedScreen(nowAsksFixture, `/_board/item/${task}/`, { home: "home.md" })],
		function* ({ findElement, readText }) {
			yield* eventually(() => expect(findElement(".item-summary [data-status-token]")).not.toBeNull());
			expect(readText(".item-summary [data-status-token]")).toBe(chip);
		},
	);
}
